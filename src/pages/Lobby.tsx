import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useWallet } from "@solana/wallet-adapter-react";
import { useGame } from "@/context/GameContext";
import PlayerCustomization from "@/components/Lobby/PlayerCustomization";
import RoomList from "@/components/Lobby/RoomList";
import CurrentRoom from "@/components/Lobby/CurrentRoom";
import WalletButton from "@/components/Wallet/WalletButton";
import MobileLobbyLayout from "@/components/Lobby/MobileLobbyLayout";
import AdminSheet from "@/components/Admin/AdminSheet";
import { LobbyModeBar } from "@/components/Lobby/LobbyModeBar";
import { Button } from "@/components/ui/button";
import { Gamepad2Icon, ArrowLeft, Wallet, Zap } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle, 
  SheetTrigger 
} from "@/components/ui/sheet";
import { useAutoCleanup } from "@/hooks/useAutoCleanup";
import { useIsMobile } from "@/hooks/use-mobile";

export default function Lobby() {
  const { 
    player, 
    refreshCurrentRoom, 
    leaveRoom, 
    currentRoom, 
    rooms, 
    joinRoom, 
    joinGame,
    setPlayerReady,
    startGame
  } = useGame();
  const { connected, publicKey } = useWallet();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isCreatingTestGame, setIsCreatingTestGame] = useState(false);
  const [hasInitialized, setHasInitialized] = useState(false);
  const [activeMode, setActiveMode] = useState<"multiplayer" | "solo">("multiplayer");
  const isMobile = useIsMobile();
  
  useAutoCleanup({
    intervalMinutes: 10,
    enableLogging: true
  });
  
  useEffect(() => {
    const initializeLobby = async () => {
      if (hasInitialized) return;
      
      console.log("Initializing lobby...");
      setHasInitialized(true);
      
      try {
        const gameState = localStorage.getItem('agar3-fun-game-state');
        if (gameState) {
          const parsedState = JSON.parse(gameState);
          if (parsedState.status === 'finished') {
            console.log("Found finished game, cleaning up...");
            localStorage.removeItem('agar3-fun-game-state');
            
            if (currentRoom && currentRoom.status === 'finished') {
              await leaveRoom();
            }
          }
        }
        
        await refreshCurrentRoom();
        console.log("Lobby initialization complete");
        
      } catch (error) {
        console.error("Error during lobby initialization:", error);
        localStorage.removeItem('agar3-fun-current-room');
        localStorage.removeItem('agar3-fun-game-state');
      }
    };
    
    initializeLobby();
  }, [hasInitialized, currentRoom, leaveRoom, refreshCurrentRoom]);
  
  const handleToggleReady = async () => {
    if (!player || !currentRoom) {
      toast({
        title: "Erreur",
        description: "Impossible de changer l'état de préparation.",
        variant: "destructive",
      });
      return;
    }
    
    try {
      const newReadyState = !isCurrentPlayerReady();
      await setPlayerReady(newReadyState);
      
      toast({
        title: newReadyState ? "READY_ACTIVATED" : "READY_CANCELLED",
        description: newReadyState ? "Vous êtes prêt à jouer !" : "Vous n'êtes plus prêt.",
      });
    } catch (error) {
      console.error("Error toggling ready state:", error);
      toast({
        title: "Erreur",
        description: "Impossible de changer l'état de préparation.",
        variant: "destructive",
      });
    }
  };

  const handleStartGame = async () => {
    if (!currentRoom) {
      toast({
        title: "Erreur",
        description: "Impossible de démarrer la partie.",
        variant: "destructive",
      });
      return;
    }

    try {
      await startGame();
    } catch (error) {
      console.error("Error starting game:", error);
      toast({
        title: "Erreur",
        description: "Impossible de démarrer la partie.",
        variant: "destructive",
      });
    }
  };

  const handleLeaveRoom = async () => {
    try {
      await leaveRoom();
      toast({
        title: "ROOM_LEFT",
        description: "Vous avez quitté la salle.",
      });
    } catch (error) {
      console.error("Error leaving room:", error);
      toast({
        title: "Erreur",
        description: "Impossible de quitter la salle.",
        variant: "destructive",
      });
    }
  };

  const isCurrentPlayerReady = (): boolean => {
    if (!player || !currentRoom?.players) return false;
    
    const currentPlayer = currentRoom.players.find(p => 
      p.id === player.id || 
      p.id === player.walletAddress ||
      (p.name === player.name && p.name.trim() !== '')
    );
    
    return currentPlayer?.isReady || false;
  };

  const isCurrentPlayerInRoom = (): boolean => {
    if (!player || !currentRoom?.players) {
      console.log("Lobby - No player or no room players");
      return false;
    }
    
    const playerInRoom = currentRoom.players.some(p => 
      p.id === player.id || 
      p.id === player.walletAddress ||
      (p.name === player.name && p.name.trim() !== '')
    );
    
    console.log("Lobby - Player in room check:", {
      playerName: player.name,
      playerId: player.id,
      playerWallet: player.walletAddress,
      roomPlayers: currentRoom.players.map(p => ({ id: p.id, name: p.name })),
      result: playerInRoom
    });
    
    return playerInRoom;
  };
  
  const handleTestGame = async () => {
    if (!player) {
      toast({
        title: "ERREUR_SYSTÈME",
        description: "Veuillez configurer votre BLOB_PROTOCOL avant de lancer le mode test",
        variant: "destructive"
      });
      return;
    }
    
    if (isCreatingTestGame) return;
    
    try {
      setIsCreatingTestGame(true);
      
      toast({
        title: "SOLO_MODE_ACTIVATED",
        description: "Préparation du protocole local..."
      });
      
      setTimeout(() => {
        navigate('/game?local=true');
        setIsCreatingTestGame(false);
      }, 500);
      
    } catch (error) {
      setIsCreatingTestGame(false);
      console.error("Erreur lors du lancement du mode test:", error);
      toast({
        title: "PROTOCOL_ERROR",
        description: "Impossible de démarrer le mode test",
        variant: "destructive"
      });
    }
  };
  
  const handleLocalGame = () => {
    if (!player) {
      toast({
        title: "BLOB_NOT_CONFIGURED",
        description: "Veuillez configurer votre BLOB_PROTOCOL avant de créer une partie locale",
        variant: "destructive"
      });
      return;
    }
    
    navigate('/game?local=true');
  };

  const handleZoneBattle = () => {
    if (!player) {
      toast({
        title: "ACCESS_DENIED",
        description: "Configuration BLOB_PROTOCOL requise pour accéder à la ZONE_BATTLE",
        variant: "destructive"
      });
      return;
    }
    
    toast({
      title: "ZONE_BATTLE_INITIATED",
      description: "Préparez-vous pour la bataille dans la zone qui rétrécit !"
    });
    
    navigate('/game?local=true&mode=zone');
  };
  
  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };
  
  const getColorHex = (color: string): string => {
    const colorMap: Record<string, string> = {
      blue: '3498db',
      red: 'e74c3c',
      green: '2ecc71',
      yellow: 'f1c40f',
      purple: '9b59b6',
      orange: 'e67e22',
      cyan: '1abc9c',
      pink: 'fd79a8'
    };
    return colorMap[color] || '3498db';
  };

  if (isMobile) {
    return (
      <MobileLobbyLayout
        player={player}
        connected={connected}
        publicKey={publicKey}
        handleTestGame={handleTestGame}
        handleLocalGame={handleLocalGame}
        handleZoneBattle={handleZoneBattle}
        isCreatingTestGame={isCreatingTestGame}
        formatAddress={formatAddress}
        getColorHex={getColorHex}
      />
    );
  }
  
  return (
    <div className="min-h-screen bg-black relative overflow-hidden">
      
      <div className="absolute inset-0">
        <div className="absolute inset-0 opacity-20">
          <div className="grid-background"></div>
        </div>
        
        <div className="absolute inset-0 pointer-events-none">
          <div className="scan-line"></div>
        </div>
        
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {[...Array(15)].map((_, i) => (
            <div
              key={i}
              className="absolute w-1 h-1 bg-cyber-cyan rounded-full animate-float"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 6}s`,
                animationDuration: `${4 + Math.random() * 4}s`
              }}
            />
          ))}
        </div>
      </div>

      <div className="relative z-10 container mx-auto py-10">
        
        <div className="flex justify-between items-center mb-8">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => navigate("/")}
            className="text-cyber-cyan hover:text-cyber-magenta hover:bg-cyber-cyan/10 border border-cyber-cyan/30 hover:border-cyber-magenta/50 transition-all duration-300 rounded-none"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          
          <div className="flex items-center">
            <div className="relative mr-3">
              
              <svg width="32" height="32" viewBox="0 0 397.7 311.7" className="text-cyber-cyan animate-neon-pulse" fill="currentColor">
                <linearGradient id="lobbyGradient" x1="360.8791" y1="351.4553" x2="141.213" y2="-69.2936" gradientUnits="userSpaceOnUse">
                  <stop offset="0" stopColor="#00FFF0"/>
                  <stop offset="1" stopColor="#DC1FFF"/>
                </linearGradient>
                <path d="M64.6,237.9c2.4-2.4,5.7-3.8,9.2-3.8h317.4c5.8,0,8.7,7,4.6,11.1l-62.7,62.7c-2.4,2.4-5.7,3.8-9.2,3.8H6.5c-5.8,0-8.7-7-4.6-11.1L64.6,237.9z" fill="url(#lobbyGradient)"/>
                <path d="M64.6,3.8C67.1,1.4,70.4,0,73.8,0h317.4c5.8,0,8.7,7,4.6,11.1l-62.7,62.7c-2.4,2.4-5.7,3.8-9.2,3.8H6.5c-5.8,0-8.7-7-4.6-11.1L64.6,3.8z" fill="url(#lobbyGradient)"/>
                <path d="M333.1,120.1c-2.4-2.4-5.7-3.8-9.2-3.8H6.5c-5.8,0-8.7,7-4.6,11.1l62.7,62.7c2.4,2.4,5.7,3.8,9.2,3.8h317.4c5.8,0,8.7-7,4.6-11.1L333.1,120.1z" fill="url(#lobbyGradient)"/>
              </svg>
              <div className="absolute inset-0 bg-cyber-cyan/20 rounded-full blur-lg animate-pulse"></div>
            </div>
            <h1 className="text-4xl font-pixel text-cyber-cyan tracking-wider animate-neon-pulse">
              agar3<span className="text-cyber-yellow">.fun</span>
            </h1>
          </div>
          
          <div className="flex items-center gap-3">
            <AdminSheet />
            <WalletButton />
            
            {connected && publicKey && (
              <Sheet>
                <SheetTrigger asChild>
                  <Button 
                    variant="ghost"
                    className={`font-mono border ${player ? 
                      "border-cyber-green/50 text-cyber-green hover:bg-cyber-green/10 hover:border-cyber-green" : 
                      "border-cyber-cyan/50 text-cyber-cyan hover:bg-cyber-cyan/10 hover:border-cyber-cyan"
                    } bg-black/50 backdrop-blur-sm transition-all duration-300`}
                  >
                    {player ? (
                      <>
                        <div 
                          className="w-6 h-6 rounded-full mr-2 border border-cyber-green/30"
                          style={{ backgroundColor: `#${getColorHex(player.color)}` }}
                        ></div>
                        <span>{player.name}</span>
                      </>
                    ) : (
                      <>
                        <Zap className="w-4 h-4 mr-2" />
                        CONFIGURE_BLOB
                      </>
                    )}
                  </Button>
                </SheetTrigger>
                <SheetContent className="bg-black/95 backdrop-blur-md border-cyber-cyan/30">
                  <SheetHeader className="mb-5">
                    <SheetTitle className="text-cyber-cyan font-mono">BLOB_CONFIGURATION</SheetTitle>
                  </SheetHeader>
                  <PlayerCustomization />
                </SheetContent>
              </Sheet>
            )}
          </div>
        </div>
        
        <div className="flex flex-col items-center mb-10">
          <div className="mb-4">
            <p className="text-cyber-green font-mono text-lg animate-terminal-blink">
              &gt; GAME_LOBBY_INITIALIZED
            </p>
          </div>
          <h2 className="text-3xl font-pixel text-cyber-cyan mb-3 animate-neon-pulse">MAINNET LOBBY</h2>
          <p className="text-gray-400 max-w-lg text-center font-mono">
            Connectez votre wallet Solana et configurez votre <span className="text-cyber-magenta">BLOB_PROTOCOL</span> pour commencer.
          </p>
        </div>
        
        {!connected || !publicKey ? (
          <div className="max-w-md mx-auto relative">
            <div className="absolute inset-0 bg-gradient-to-r from-cyber-cyan/20 to-cyber-magenta/20 rounded-lg blur-xl"></div>
            <div className="relative bg-black/80 backdrop-blur-sm p-6 rounded-lg border-2 border-cyber-cyan/50 shadow-[0_0_20px_rgba(0,255,255,0.2)] text-center">
              <div className="bg-gradient-to-r from-cyber-cyan to-cyber-blue w-16 h-16 rounded-lg flex items-center justify-center mx-auto mb-4 shadow-[0_0_15px_rgba(0,255,255,0.5)]">
                <Wallet className="text-black" size={28} />
              </div>
              <h3 className="text-xl font-bold text-cyber-cyan mb-4 font-mono">WALLET_CONNECTION_REQUIRED</h3>
              <p className="text-gray-300 mb-6 font-mono text-sm leading-relaxed">
                Votre adresse wallet Solana sera votre <span className="text-cyber-yellow">IDENTITÉ_UNIQUE</span> dans le protocole. 
                Connectez votre wallet pour continuer.
              </p>
              <WalletButton className="w-full flex justify-center bg-gradient-to-r from-cyber-cyan to-cyber-magenta hover:from-cyber-magenta hover:to-cyber-cyan text-black font-mono font-bold" />
            </div>
          </div>
        ) : !player ? (
          <div className="max-w-md mx-auto relative">
            <div className="absolute inset-0 bg-gradient-to-r from-cyber-magenta/20 to-cyber-yellow/20 rounded-lg blur-xl"></div>
            <div className="relative bg-black/80 backdrop-blur-sm p-6 rounded-lg border-2 border-cyber-magenta/50 shadow-[0_0_20px_rgba(255,0,255,0.2)] text-center">
              <div className="bg-gradient-to-r from-cyber-magenta to-cyber-purple w-16 h-16 rounded-lg flex items-center justify-center mx-auto mb-4 shadow-[0_0_15px_rgba(255,0,255,0.5)]">
                <Zap className="text-black" size={28} />
              </div>
              <h3 className="text-xl font-bold text-cyber-magenta mb-4 font-mono">BLOB_CONFIGURATION_REQUIRED</h3>
              <p className="text-gray-300 mb-4 font-mono text-sm">
                Votre wallet est connecté ! Maintenant configurez votre <span className="text-cyber-cyan">BLOB_PROTOCOL</span> pour rejoindre ou créer des parties.
              </p>
              <div className="mb-4 p-3 bg-cyber-green/10 rounded-lg border border-cyber-green/30">
                <div className="flex items-center justify-center gap-2">
                  <Wallet className="h-4 w-4 text-cyber-green" />
                  <span className="text-sm font-medium text-cyber-green font-mono">
                    {formatAddress(publicKey.toString())}
                  </span>
                </div>
              </div>
              <Sheet>
                <SheetTrigger asChild>
                  <Button className="w-full bg-gradient-to-r from-cyber-magenta to-cyber-cyan hover:from-cyber-cyan hover:to-cyber-magenta text-black font-mono font-bold">
                    CONFIGURE_BLOB_PROTOCOL
                  </Button>
                </SheetTrigger>
                <SheetContent className="bg-black/95 backdrop-blur-md border-cyber-cyan/30">
                  <SheetHeader className="mb-5">
                    <SheetTitle className="text-cyber-cyan font-mono">BLOB_CONFIGURATION</SheetTitle>
                  </SheetHeader>
                  <PlayerCustomization />
                </SheetContent>
              </Sheet>
            </div>
          </div>
        ) : (
          <div className="w-full max-w-5xl mx-auto">
            
            <div className="mb-6 max-w-2xl mx-auto">
              <LobbyModeBar 
                active={activeMode} 
                onSelect={setActiveMode}
              />
            </div>
            
            {activeMode === "multiplayer" ? (
              <div className="space-y-6">
                
                {currentRoom && (
                  <CurrentRoom
                    currentRoom={currentRoom}
                    countdown={null}
                    gameStarting={false}
                    handleToggleReady={handleToggleReady}
                    handleStartGame={handleStartGame}
                    handleLeaveRoom={handleLeaveRoom}
                    handleJoinGame={joinGame}
                    handleJoinRoom={joinRoom}
                    isCurrentPlayerReady={isCurrentPlayerReady}
                    isCurrentPlayerInRoom={isCurrentPlayerInRoom}
                  />
                )}
                
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-cyber-cyan/20 to-cyber-green/20 rounded-lg blur-xl"></div>
                  <div className="relative bg-black/80 backdrop-blur-sm rounded-lg p-6 border-2 border-cyber-cyan/50 shadow-[0_0_20px_rgba(0,255,255,0.2)]">
                    <RoomList 
                      rooms={rooms}
                      currentRoomId={currentRoom?.id}
                      handleJoinRoom={joinRoom}
                      handleJoinGame={joinGame}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-cyber-magenta/20 to-cyber-purple/20 rounded-lg blur-xl"></div>
                <div className="relative bg-black/80 backdrop-blur-sm rounded-lg p-6 border-2 border-cyber-magenta/50 shadow-[0_0_20px_rgba(255,0,255,0.2)]">
                  <h2 className="text-2xl font-bold mb-4 text-cyber-magenta font-mono">SOLO_PROTOCOLS</h2>
                  <p className="text-gray-300 mb-6 font-mono">
                    Lancez une session rapide en solo, sans attendre d'autres <span className="text-cyber-cyan">NODES</span>.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 justify-center mt-6">
                    <Button 
                      onClick={handleTestGame}
                      disabled={isCreatingTestGame}
                      className="bg-gradient-to-r from-cyber-yellow to-cyber-orange hover:from-cyber-orange hover:to-cyber-yellow text-black font-mono font-bold px-6 py-3 text-lg rounded-none border border-cyber-yellow/50 shadow-[0_0_15px_rgba(255,255,0,0.3)] hover:shadow-[0_0_25px_rgba(255,165,0,0.5)] transition-all duration-300"
                    >
                      {isCreatingTestGame ? (
                        <>
                          <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-black border-t-transparent"></div>
                          LOADING...
                        </>
                      ) : (
                        <>
                          <Gamepad2Icon className="mr-2" />
                          TEST_MODE
                        </>
                      )}
                    </Button>
                    
                    <Button 
                      onClick={handleLocalGame}
                      className="bg-gradient-to-r from-cyber-green to-cyber-cyan hover:from-cyber-cyan hover:to-cyber-green text-black font-mono font-bold px-6 py-3 text-lg rounded-none border border-cyber-green/50 shadow-[0_0_15px_rgba(0,255,0,0.3)] hover:shadow-[0_0_25px_rgba(0,255,255,0.5)] transition-all duration-300"
                    >
                      <Gamepad2Icon className="mr-2" />
                      LOCAL_MODE
                    </Button>

                    <Button 
                      onClick={handleZoneBattle}
                      className="bg-gradient-to-r from-cyber-purple to-cyber-magenta hover:from-cyber-magenta hover:to-cyber-purple text-white font-mono font-bold px-6 py-3 text-lg rounded-none border border-cyber-purple/50 shadow-[0_0_15px_rgba(128,0,255,0.3)] hover:shadow-[0_0_25px_rgba(255,0,255,0.5)] transition-all duration-300"
                    >
                      <Gamepad2Icon className="mr-2" />
                      ZONE_BATTLE
                    </Button>
                  </div>
                  
                  <div className="mt-8 space-y-4">
                    <div className="p-4 bg-cyber-yellow/10 rounded-lg border border-cyber-yellow/30">
                      <h4 className="font-bold text-cyber-yellow font-mono mb-2">TEST_MODE.exe</h4>
                      <p className="text-sm text-gray-300 font-mono">Session rapide sans contraintes pour tester les mécaniques de base.</p>
                    </div>
                    
                    <div className="p-4 bg-cyber-green/10 rounded-lg border border-cyber-green/30">
                      <h4 className="font-bold text-cyber-green font-mono mb-2">LOCAL_MODE.sol</h4>
                      <p className="text-sm text-gray-300 font-mono">Jeu en solo classique, idéal pour perfectionner votre technique.</p>
                    </div>
                    
                    <div className="p-4 bg-cyber-purple/10 rounded-lg border border-cyber-purple/30">
                      <h4 className="font-bold text-cyber-purple font-mono mb-2">ZONE_BATTLE.war</h4>
                      <p className="text-sm text-gray-300 font-mono">
                        Mode de survie avec une zone qui rétrécit toutes les 2 minutes. 
                        Restez dans la <span className="text-cyber-green">SAFE_ZONE</span> ou perdez de la taille !
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
        
        <div className="mt-12 relative">
          <div className="absolute inset-0 bg-gradient-to-r from-cyber-green/20 to-cyber-cyan/20 rounded-lg blur-xl"></div>
          <div className="relative bg-black/90 backdrop-blur-sm rounded-lg p-8 border-2 border-cyber-green/30 shadow-[0_0_20px_rgba(0,255,0,0.2)]">
            <div className="flex items-center mb-6">
              <div className="w-3 h-3 bg-cyber-magenta rounded-full mr-2 animate-pulse"></div>
              <div className="w-3 h-3 bg-cyber-yellow rounded-full mr-2 animate-pulse" style={{animationDelay: '0.2s'}}></div>
              <div className="w-3 h-3 bg-cyber-green rounded-full mr-4 animate-pulse" style={{animationDelay: '0.4s'}}></div>
              <h2 className="text-2xl font-bold text-cyber-green font-mono">PROTOCOL_TUTORIAL.md</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex items-start">
                <div className="bg-cyber-yellow text-black font-bold font-mono rounded w-8 h-8 flex items-center justify-center mr-3 flex-shrink-0 shadow-[0_0_10px_rgba(255,255,0,0.5)]">0x1</div>
                <p className="text-gray-300 font-mono text-sm">Déplacez votre blob avec la souris pour absorber la <span className="text-cyber-cyan">FOOD_DATA</span> et grossir 🍰</p>
              </div>
              <div className="flex items-start">
                <div className="bg-cyber-cyan text-black font-bold font-mono rounded w-8 h-8 flex items-center justify-center mr-3 flex-shrink-0 shadow-[0_0_10px_rgba(0,255,255,0.5)]">0x2</div>
                <p className="text-gray-300 font-mono text-sm">Mangez les joueurs plus petits que vous (au moins <span className="text-cyber-magenta">10%</span> plus petits) 🥵</p>
              </div>
              <div className="flex items-start">
                <div className="bg-cyber-magenta text-black font-bold font-mono rounded w-8 h-8 flex items-center justify-center mr-3 flex-shrink-0 shadow-[0_0_10px_rgba(255,0,255,0.5)]">0x3</div>
                <p className="text-gray-300 font-mono text-sm">Évitez les <span className="text-cyber-purple">RUG_CARPETS</span> violets qui vous feront rétrécir 📉</p>
              </div>
              <div className="flex items-start">
                <div className="bg-cyber-green text-black font-bold font-mono rounded w-8 h-8 flex items-center justify-center mr-3 flex-shrink-0 shadow-[0_0_10px_rgba(0,255,0,0.5)]">0x4</div>
                <p className="text-gray-300 font-mono text-sm">Le dernier blob en vie devient le <span className="text-cyber-yellow">ULTIMATE_WHALE</span> ! 👑</p>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <footer className="relative z-10 mt-20 text-center">
        <p className="text-gray-500 text-sm font-mono">
          © 2025 agar3.fun - <span className="text-cyber-cyan">HODLING</span> since genesis block 🚀
        </p>
        <p className="text-gray-600 text-xs font-mono mt-1">
          Not financial advice | DYOR | Diamond hands only 💎🙌
        </p>
      </footer>
    </div>
  );
}
