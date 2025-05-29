
import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw, PlusCircle } from "lucide-react";
import { useGame } from "@/context/GameContext";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import CreateRoomDialog from "./CreateRoomDialog";
import CurrentRoom from "./CurrentRoom";
import AvailableRooms from "./AvailableRooms";
import { GameRoom } from "@/types/game";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAutoCleanup } from "@/hooks/useAutoCleanup";

export default function RoomList() {
  const { rooms, createRoom, joinRoom, player, currentRoom, startGame, leaveRoom, setPlayerReady, refreshCurrentRoom } = useGame();
  const [roomName, setRoomName] = useState("");
  const [maxPlayers, setMaxPlayers] = useState("4");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [gameStarting, setGameStarting] = useState(false);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [lastToastMessage, setLastToastMessage] = useState<string>("");
  const [hasNavigated, setHasNavigated] = useState(false);
  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastToastTimeRef = useRef<number>(0);
  const { toast } = useToast();
  const navigate = useNavigate();

  // Fonction pour éviter les toasts répétitifs
  const showToastWithThrottle = (title: string, description: string, variant?: "default" | "destructive") => {
    const now = Date.now();
    const messageKey = `${title}-${description}`;
    
    // Prevent duplicate messages within 3 seconds
    if (now - lastToastTimeRef.current > 3000 && lastToastMessage !== messageKey) {
      lastToastTimeRef.current = now;
      setLastToastMessage(messageKey);
      toast({ title, description, variant });
      
      // Clear the last message after 3 seconds
      setTimeout(() => setLastToastMessage(""), 3000);
    }
  };

  // Premier chargement forcé au montage du composant
  useEffect(() => {
    const initialLoad = async () => {
      console.log("Initial room load started");
      await refreshCurrentRoom();
      console.log("Initial room refresh completed");
    };
    
    initialLoad();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Clear selection when currentRoom changes
  useEffect(() => {
    if (currentRoom) {
      setSelectedRoomId(null);
    }
  }, [currentRoom]);

  // Logique simplifiée pour le countdown - 3 secondes au lieu de 5
  useEffect(() => {
    if (
      currentRoom && 
      currentRoom.status === 'waiting' && 
      currentRoom.players && 
      currentRoom.players.length >= 2 && 
      currentRoom.players.every(p => p.ready === true) &&
      !gameStarting
    ) {
      // Launch countdown if all players are ready
      if (countdown === null) {
        console.log("All players ready, starting 3-second countdown");
        setCountdown(3); // Réduit de 5 à 3 secondes
        
        showToastWithThrottle("Tous les joueurs sont prêts !", "La partie démarre dans 3 secondes...");
      }
    } else {
      // Cancel countdown if a player is no longer ready
      if (countdown !== null) {
        console.log("Player not ready anymore, cancelling countdown");
        setCountdown(null);
        if (countdownTimerRef.current) {
          clearInterval(countdownTimerRef.current);
          countdownTimerRef.current = null;
        }
      }
    }
  }, [currentRoom, countdown, gameStarting]);

  // Handle countdown avec navigation immédiate
  useEffect(() => {
    if (countdown !== null && countdown > 0 && !gameStarting) {
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
      }
      
      countdownTimerRef.current = setInterval(() => {
        setCountdown(prev => {
          if (prev === null || prev <= 1) {
            if (countdownTimerRef.current) {
              clearInterval(countdownTimerRef.current);
              countdownTimerRef.current = null;
            }
            
            if (!gameStarting) {
              setGameStarting(true);
              
              console.log("Starting game from countdown...");
              
              startGame().then((success) => {
                if (success && !hasNavigated) {
                  console.log("Game started successfully, navigating immediately");
                  setHasNavigated(true);
                  showToastWithThrottle("🎮 Partie lancée !", "Redirection vers le jeu...");
                  
                  // Navigation immédiate sans délai
                  navigate('/game');
                } else {
                  setGameStarting(false);
                  showToastWithThrottle("Erreur", "Impossible de démarrer la partie", "destructive");
                }
              }).catch(error => {
                console.error("Error starting game:", error);
                setGameStarting(false);
                showToastWithThrottle("Erreur", "Impossible de démarrer la partie", "destructive");
              });
            }
            
            return null;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
      }
    };
  }, [countdown, startGame, gameStarting, navigate, hasNavigated]);

  // Navigation automatique si le jeu est en cours
  useEffect(() => {
    if (currentRoom?.status === 'playing' && !gameStarting && !hasNavigated) {
      console.log("Game is playing, navigating to game");
      setHasNavigated(true);
      navigate('/game');
    }
  }, [currentRoom?.status, navigate, gameStarting, hasNavigated]);

  // Reset navigation flag when leaving room
  useEffect(() => {
    if (!currentRoom) {
      setHasNavigated(false);
      setGameStarting(false);
    }
  }, [currentRoom]);

  const handleCreateRoom = async () => {
    if (!player) {
      showToastWithThrottle("Erreur", "Veuillez définir votre nom et votre couleur avant de créer une salle", "destructive");
      return;
    }
    
    if (roomName.trim()) {
      try {
        console.log(`Création de salle: "${roomName}" avec ${maxPlayers} joueurs max`);
        const roomId = await createRoom(roomName, parseInt(maxPlayers));
        
        if (roomId) {
          console.log("Salle créée avec ID:", roomId);
          setCreateDialogOpen(false);
          
          showToastWithThrottle("Salle créée", `Votre salle "${roomName}" a été créée avec succès.`);
          
          // Refresh immédiat et rejoindre directement
          setTimeout(async () => {
            await refreshCurrentRoom();
            try {
              await joinRoom(roomId);
            } catch (joinError) {
              console.error("Erreur lors de la connexion automatique:", joinError);
            }
          }, 500);
        }
      } catch (error) {
        console.error("Erreur lors de la création:", error);
        showToastWithThrottle("Erreur", "Impossible de créer la salle. Veuillez réessayer.", "destructive");
      }
    }
  };

  const handleJoinRoom = async (roomId: string) => {
    console.log("Joining room:", roomId);
    await joinRoom(roomId);
  };

  const handleStartGame = async () => {
    if (gameStarting) return;
    
    try {
      setGameStarting(true);
      const success = await startGame();
      if (success && !hasNavigated) {
        setHasNavigated(true);
        navigate('/game');
      } else if (!success) {
        setGameStarting(false);
        showToastWithThrottle("Erreur", "Impossible de démarrer la partie", "destructive");
      }
    } catch (error) {
      console.error("Error starting game:", error);
      setGameStarting(false);
      showToastWithThrottle("Erreur", "Impossible de démarrer la partie", "destructive");
    }
  };

  const handleJoinGame = () => {
    if (!hasNavigated) {
      setHasNavigated(true);
      navigate('/game');
    }
  };

  const handleLeaveRoom = async () => {
    await leaveRoom();
    setTimeout(() => {
      refreshCurrentRoom();
    }, 300);
  };

  const handleToggleReady = async () => {
    if (!currentRoom || !player) return;
    
    const currentPlayer = currentRoom.players && currentRoom.players.find(p => p.id === player.id);
    if (currentPlayer) {
      await setPlayerReady(!currentPlayer.ready);
    } else {
      await setPlayerReady(true);
    }
  };

  const handleRefresh = async () => {
    if (isRefreshing) return;
    
    setIsRefreshing(true);
    
    try {
      await refreshCurrentRoom();
      console.log("Rafraîchissement manuel terminé");
      
      showToastWithThrottle("Actualisé", `${rooms.length} salles trouvées.`);
    } catch (error) {
      console.error("Erreur lors du rafraîchissement:", error);
      showToastWithThrottle("Erreur", "Impossible de récupérer les salles.", "destructive");
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleSelectRoom = (roomId: string) => {
    setSelectedRoomId(prev => prev === roomId ? null : roomId);
  };

  const isCurrentPlayerReady = () => {
    if (!currentRoom || !player || !currentRoom.players) return false;
    const currentPlayer = currentRoom.players.find(p => p.id === player.id);
    return !!currentPlayer?.ready;
  };

  const isCurrentPlayerInRoom = () => {
    if (!currentRoom || !player || !currentRoom.players) return false;
    return currentRoom.players.some(p => p.id === player.id);
  };
  
  const selectedRoom = selectedRoomId ? rooms.find(r => r.id === selectedRoomId) : null;

  useAutoCleanup({ 
    intervalMinutes: 15,
    enableLogging: true 
  });

  return (
    <div className="w-full max-w-4xl bg-black/90 backdrop-blur-sm rounded-lg border-2 border-cyber-cyan/50 shadow-[0_0_20px_rgba(0,255,255,0.2)]">
      <div className="flex justify-between items-center p-6 border-b border-cyber-cyan/30">
        <h2 className="text-2xl font-bold text-cyber-cyan font-mono">GAME_ROOMS</h2>
        
        <div className="flex space-x-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleRefresh}
            disabled={isRefreshing}
            title="Rafraîchir les salles"
            className="text-cyber-cyan hover:text-cyber-magenta hover:bg-cyber-cyan/10 border border-cyber-cyan/30 hover:border-cyber-magenta/50 transition-all duration-300"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </Button>
          
          <CreateRoomDialog 
            open={createDialogOpen}
            onOpenChange={(open) => {
              if (open) {
                setRoomName("");
                setMaxPlayers("4");
              }
              setCreateDialogOpen(open);
            }}
            roomName={roomName}
            setRoomName={setRoomName}
            maxPlayers={maxPlayers}
            setMaxPlayers={setMaxPlayers}
            handleCreateRoom={handleCreateRoom}
            playerExists={!!player}
          />
        </div>
      </div>
      
      <div className="p-6">
        {/* Current room panel */}
        {currentRoom ? (
          <CurrentRoom 
            currentRoom={currentRoom}
            countdown={countdown}
            gameStarting={gameStarting}
            handleToggleReady={handleToggleReady}
            handleStartGame={handleStartGame}
            handleLeaveRoom={handleLeaveRoom}
            handleJoinGame={handleJoinGame}
            handleJoinRoom={handleJoinRoom}
            isCurrentPlayerReady={isCurrentPlayerReady}
            isCurrentPlayerInRoom={isCurrentPlayerInRoom}
          />
        ) : selectedRoom ? (
          <div className="mb-6 relative">
            <div className="absolute inset-0 bg-gradient-to-r from-cyber-cyan/20 to-cyber-magenta/20 rounded-lg blur-xl"></div>
            <div className="relative bg-black/80 backdrop-blur-sm border-2 border-cyber-cyan/50 rounded-lg p-6 shadow-[0_0_20px_rgba(0,255,255,0.2)]">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-cyber-cyan font-mono">{selectedRoom.name}</h3>
                {selectedRoom.status === 'waiting' ? (
                  <Badge className="bg-cyber-green/20 text-cyber-green border-cyber-green/50 font-mono">
                    WAITING
                  </Badge>
                ) : selectedRoom.status === 'playing' ? (
                  <Badge className="bg-cyber-yellow/20 text-cyber-yellow border-cyber-yellow/50 font-mono">
                    PLAYING
                  </Badge>
                ) : (
                  <Badge className="bg-gray-500/20 text-gray-400 border-gray-500/50 font-mono">
                    FINISHED
                  </Badge>
                )}
              </div>
              <div className="flex flex-col gap-4">
                <div>
                  <p className="text-gray-300 font-mono">
                    {selectedRoom.players?.length || 0}/{selectedRoom.maxPlayers} NODES
                  </p>
                  <p className="text-xs text-gray-500 mt-1 font-mono">
                    ID: {selectedRoom.id}
                  </p>
                  {selectedRoom.players && selectedRoom.players.length > 0 && (
                    <div className="mt-2">
                      <p className="text-sm font-medium mb-1 text-cyber-cyan font-mono">CONNECTED_NODES:</p>
                      <div className="flex flex-wrap gap-2">
                        {selectedRoom.players.map(player => (
                          <span 
                            key={player.id} 
                            className={`px-2 py-1 rounded text-sm font-mono ${
                              player.ready 
                                ? 'bg-cyber-green/20 text-cyber-green border border-cyber-green/50' 
                                : 'bg-black/50 border border-cyber-cyan/30 text-gray-300'
                            }`}
                          >
                            {player.name} {player.ready ? '✓' : '○'}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <Button 
                  className="w-full bg-gradient-to-r from-cyber-cyan to-cyber-magenta hover:from-cyber-magenta hover:to-cyber-cyan text-black font-mono font-bold" 
                  onClick={() => handleJoinRoom(selectedRoom.id)}
                  disabled={!player || 
                    (selectedRoom.players && selectedRoom.players.length >= selectedRoom.maxPlayers) ||
                    selectedRoom.status !== 'waiting'}
                >
                  {selectedRoom.status === 'waiting' ? 'JOIN_ROOM' : 'ROOM_UNAVAILABLE'}
                </Button>
              </div>
            </div>
          </div>
        ) : null}
        
        {/* Available rooms list */}
        <AvailableRooms 
          rooms={rooms}
          handleJoinRoom={handleJoinRoom}
          playerExists={!!player}
          selectedRoomId={selectedRoomId}
          onSelectRoom={handleSelectRoom}
          refreshRooms={refreshCurrentRoom}
        />
      </div>
      
      {/* Create room button */}
      {!currentRoom && (
        <div className="p-6 pt-0">
          <Button 
            className="w-full py-6 text-lg bg-gradient-to-r from-cyber-green to-cyber-cyan hover:from-cyber-cyan hover:to-cyber-green text-black font-mono font-bold border border-cyber-green/50" 
            onClick={() => setCreateDialogOpen(true)}
            disabled={!player}
          >
            <PlusCircle className="mr-2 h-5 w-5" /> CREATE_NEW_ROOM
          </Button>
        </div>
      )}
    </div>
  );
}
