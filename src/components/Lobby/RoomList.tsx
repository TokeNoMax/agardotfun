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
  const [lastCreatedRoomId, setLastCreatedRoomId] = useState<string | null>(null);
  const [lastCreatedRoomName, setLastCreatedRoomName] = useState<string | null>(null);
  const [creationErrorCount, setCreationErrorCount] = useState(0);
  const [hasShownRoomFoundToast, setHasShownRoomFoundToast] = useState(false);
  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();

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
  
  // Utiliser directement les salles de rooms au lieu de stableWaitingRooms
  useEffect(() => {
    console.log("Rooms updated:", rooms.length);
    if (rooms && rooms.length > 0) {
      console.log("Room IDs:", rooms.map(r => `${r.id} (${r.name}) - ${r.status}`).join(", "));
      
      // Vérifier si notre salle récemment créée est présente dans la liste
      if (lastCreatedRoomId && !hasShownRoomFoundToast) {
        const foundRoom = rooms.find(r => r.id === lastCreatedRoomId);
        if (foundRoom) {
          console.log(`La salle créée ${lastCreatedRoomId} est présente dans la liste!`);
          // Notification de confirmation (une seule fois)
          setHasShownRoomFoundToast(true);
          toast({
            title: "Salle trouvée",
            description: `Votre salle "${foundRoom.name}" est maintenant disponible.`,
          });
          
          // Réinitialiser le tracking après confirmation
          setTimeout(() => {
            setLastCreatedRoomId(null);
            setLastCreatedRoomName(null);
            setHasShownRoomFoundToast(false);
          }, 5000);
        } else {
          console.log(`La salle créée ${lastCreatedRoomId} (${lastCreatedRoomName}) n'est pas dans la liste!`);
        }
      }
    }
  }, [rooms, lastCreatedRoomId, lastCreatedRoomName, toast, hasShownRoomFoundToast]);

  // Clear selection when currentRoom changes
  useEffect(() => {
    if (currentRoom) {
      setSelectedRoomId(null);
    }
  }, [currentRoom]);

  // Check if all players are ready with proper null checks
  useEffect(() => {
    if (
      currentRoom && 
      currentRoom.status === 'waiting' && 
      currentRoom.players && 
      currentRoom.players.length >= 2 && 
      currentRoom.players.every(p => p.ready === true)
    ) {
      // Launch countdown if all players are ready
      if (countdown === null) {
        setCountdown(5);
      }
    } else {
      // Cancel countdown if a player is no longer ready
      if (countdown !== null) {
        setCountdown(null);
        if (countdownTimerRef.current) {
          clearInterval(countdownTimerRef.current);
          countdownTimerRef.current = null;
        }
      }
    }
  }, [currentRoom, countdown]);

  // Handle countdown with proper cleanup
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
            
            // Marquer le jeu comme démarrant mais ne pas naviguer automatiquement
            setGameStarting(true);
            
            // Launch game at the end of countdown, but require explicit user action
            startGame().catch(error => {
              console.error("Error starting game:", error);
              setGameStarting(false);
              toast({
                title: "Erreur",
                description: "Impossible de démarrer la partie",
                variant: "destructive"
              });
            });
            
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
  }, [countdown, startGame, toast, gameStarting]);

  // Mise à jour de la fonction handleCreateRoom pour réduire les notifications
  const handleCreateRoom = async () => {
    if (!player) {
      toast({
        title: "Erreur",
        description: "Veuillez définir votre nom et votre couleur avant de créer une salle",
        variant: "destructive"
      });
      return;
    }
    
    if (roomName.trim()) {
      try {
        console.log(`Tentative de création de salle: "${roomName}" avec ${maxPlayers} joueurs max`);
        const roomId = await createRoom(roomName, parseInt(maxPlayers));
        
        if (roomId) {
          console.log("ID de salle reçu:", roomId);
          // Stocker l'ID de la dernière salle créée pour suivi
          setLastCreatedRoomId(roomId);
          setLastCreatedRoomName(roomName);
          setHasShownRoomFoundToast(false);
          setCreateDialogOpen(false);
          
          // Notification simplifiée de création
          toast({
            title: "Salle créée",
            description: "Recherche de votre salle..."
          });
          
          // Séquence simplifiée de rafraîchissement
          setTimeout(async () => {
            await refreshCurrentRoom();
            console.log("Rafraîchissement après création");
            
            // Vérifier si la salle est trouvée et rejoindre directement si nécessaire
            setTimeout(async () => {
              const isRoomFound = rooms.some(r => r.id === roomId);
              if (!isRoomFound) {
                console.log("Tentative de rejoindre directement avec l'ID");
                try {
                  await joinRoom(roomId);
                } catch (joinError) {
                  console.error("Erreur de connexion directe:", joinError);
                  toast({
                    title: "Erreur de connexion",
                    description: "Impossible de se connecter à la salle créée.",
                    variant: "destructive"
                  });
                }
              }
            }, 1500);
          }, 1000);
        } else {
          console.error("Création de salle échouée: pas d'ID retourné");
          toast({
            title: "Erreur",
            description: "La création de la salle a échoué.",
            variant: "destructive"
          });
          setCreationErrorCount(prev => prev + 1);
        }
      } catch (error) {
        console.error("Erreur lors de la création:", error);
        toast({
          title: "Erreur lors de la création",
          description: "Impossible de créer la salle. Veuillez réessayer.",
          variant: "destructive"
        });
        setCreationErrorCount(prev => prev + 1);
      }
    }
  };

  // Wrap with throttling to prevent too many rapid calls
  const handleJoinRoom = async (roomId: string) => {
    console.log("Joining room:", roomId);
    await joinRoom(roomId);
  };

  const handleStartGame = async () => {
    try {
      setGameStarting(true);
      const success = await startGame();
      if (!success) {
        setGameStarting(false);
        toast({
          title: "Erreur",
          description: "Impossible de démarrer la partie",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error("Error starting game:", error);
      setGameStarting(false);
      toast({
        title: "Erreur",
        description: "Impossible de démarrer la partie",
        variant: "destructive"
      });
    }
  };

  const handleJoinGame = () => {
    navigate('/game?join=true');
  };

  // Debounced leave room to prevent multiple rapid calls
  const handleLeaveRoom = async () => {
    await leaveRoom();
    // Force refresh rooms après avoir quitté
    setTimeout(() => {
      refreshCurrentRoom();
    }, 300);
  };

  const handleToggleReady = async () => {
    if (!currentRoom || !player) return;
    
    // Find player in room to know current state with null check
    const currentPlayer = currentRoom.players && currentRoom.players.find(p => p.id === player.id);
    if (currentPlayer) {
      await setPlayerReady(!currentPlayer.ready);
    } else {
      await setPlayerReady(true);
    }
  };

  // Fonction de rafraîchissement optimisée
  const handleRefresh = async () => {
    if (isRefreshing) return;
    
    setIsRefreshing(true);
    
    try {
      await refreshCurrentRoom();
      console.log("Rafraîchissement manuel terminé");
      
      // Notification simple de fin de rafraîchissement
      toast({
        title: "Actualisé",
        description: `${rooms.length} salles trouvées.`,
      });
    } catch (error) {
      console.error("Erreur lors du rafraîchissement:", error);
      toast({
        title: "Erreur de rafraîchissement",
        description: "Impossible de récupérer les salles.",
        variant: "destructive"
      });
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
  
  // Get the selected room details - use rooms directly
  const selectedRoom = selectedRoomId ? rooms.find(r => r.id === selectedRoomId) : null;

  // Vérifier si une salle a été créée mais n'apparaît pas dans la liste
  const isLastCreatedRoomMissing = lastCreatedRoomId !== null && 
                                  !rooms.some(r => r.id === lastCreatedRoomId);

  // Activer le nettoyage automatique
  useAutoCleanup({ 
    intervalMinutes: 15, // Nettoyage toutes les 15 minutes depuis le frontend
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
                // Réinitialiser les valeurs du formulaire à l'ouverture
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
        {/* Message si trop d'erreurs de création */}
        {creationErrorCount >= 2 && (
          <div className="mb-4 p-3 bg-cyber-magenta/20 border border-cyber-magenta/50 rounded-md">
            <p className="text-cyber-magenta text-sm font-mono">
              <strong>CREATION_ERROR :</strong> Multiple failures detected. 
              Check your connection or refresh the page.
            </p>
          </div>
        )}
        
        {/* Message de débogage optimisé */}
        {isLastCreatedRoomMissing && (
          <div className="mb-4 p-3 bg-cyber-yellow/20 border border-cyber-yellow/50 rounded-md">
            <p className="text-cyber-yellow text-sm font-mono">
              <strong>ROOM_NOT_VISIBLE :</strong> Last created room 
              "{lastCreatedRoomName}" not found in list.
            </p>
            <div className="flex gap-2 mt-2">
              <Button 
                size="sm" 
                variant="outline" 
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="border-cyber-cyan/50 text-cyber-cyan hover:bg-cyber-cyan/10 font-mono"
              >
                {isRefreshing ? "REFRESHING..." : "REFRESH"}
              </Button>
              
              {lastCreatedRoomId && (
                <Button 
                  size="sm" 
                  onClick={() => joinRoom(lastCreatedRoomId)}
                  disabled={!player}
                  className="bg-gradient-to-r from-cyber-green to-cyber-cyan hover:from-cyber-cyan hover:to-cyber-green text-black font-mono"
                >
                  JOIN_DIRECT
                </Button>
              )}
            </div>
          </div>
        )}
      
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
