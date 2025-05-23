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

export default function RoomList() {
  const { rooms, createRoom, joinRoom, player, currentRoom, startGame, leaveRoom, setPlayerReady, refreshCurrentRoom } = useGame();
  const [roomName, setRoomName] = useState("");
  const [maxPlayers, setMaxPlayers] = useState("4");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [gameStarting, setGameStarting] = useState(false);
  const [stableWaitingRooms, setStableWaitingRooms] = useState<GameRoom[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();
  const previousRoomsRef = useRef<string>("");
  
  // Enhanced room filtering with stabilization to prevent flickering
  useEffect(() => {
    if (rooms) {
      const filteredRooms = rooms.filter(room => 
        room.status === 'waiting' && 
        (!currentRoom || room.id !== currentRoom.id) && 
        room.maxPlayers > 1 && // Filter out solo rooms
        !room.name.toLowerCase().includes('test_max_') // Filter out test rooms
      );
      
      // Mettre à jour immédiatement sans comparaison pour s'assurer que les nouvelles salles apparaissent
      setStableWaitingRooms(filteredRooms);
      previousRoomsRef.current = JSON.stringify(filteredRooms.map(r => r.id));
    }
  }, [rooms, currentRoom]);

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
        const roomId = await createRoom(roomName, parseInt(maxPlayers));
        setCreateDialogOpen(false);
        
        // Force refresh pour s'assurer que la nouvelle salle apparaît
        setTimeout(() => {
          refreshCurrentRoom();
        }, 300);
        
        await joinRoom(roomId);
      } catch (error) {
        console.error("Error creating room:", error);
      }
    }
  };

  // Wrap with throttling to prevent too many rapid calls
  const handleJoinRoom = async (roomId: string) => {
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

  // Fonction de rafraîchissement avec un délai plus court
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refreshCurrentRoom();
    setTimeout(() => setIsRefreshing(false), 300);
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
  
  // Get the selected room details
  const selectedRoom = selectedRoomId ? rooms.find(r => r.id === selectedRoomId) : null;

  return (
    <div className="w-full max-w-4xl bg-white rounded-lg shadow-lg">
      <div className="flex justify-between items-center p-6 border-b">
        <h2 className="text-2xl font-bold">Salles de jeu</h2>
        
        <div className="flex space-x-2">
          <Button
            variant="outline"
            size="icon"
            onClick={handleRefresh}
            className={`${isRefreshing ? 'animate-spin' : ''}`}
            title="Rafraîchir les salles"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
          
          <CreateRoomDialog 
            open={createDialogOpen}
            onOpenChange={setCreateDialogOpen}
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
          <Card className="mb-6 border-2 border-indigo-300">
            <CardHeader className="pb-2">
              <CardTitle className="flex justify-between items-center">
                {selectedRoom.name}
                {selectedRoom.status === 'waiting' ? (
                  <Badge className="bg-green-100 text-green-800 border-green-200">
                    En attente
                  </Badge>
                ) : selectedRoom.status === 'playing' ? (
                  <Badge className="bg-amber-100 text-amber-800 border-amber-200">
                    En cours
                  </Badge>
                ) : (
                  <Badge className="bg-gray-100 text-gray-800 border-gray-200">
                    Terminée
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-4">
                <div>
                  <p className="text-gray-600">
                    {selectedRoom.players?.length || 0}/{selectedRoom.maxPlayers} joueurs
                  </p>
                  {selectedRoom.players && selectedRoom.players.length > 0 && (
                    <div className="mt-2">
                      <p className="text-sm font-medium mb-1">Joueurs:</p>
                      <div className="flex flex-wrap gap-2">
                        {selectedRoom.players.map(player => (
                          <span 
                            key={player.id} 
                            className={`px-2 py-1 rounded text-sm ${
                              player.ready 
                                ? 'bg-green-100 text-green-800 border border-green-300' 
                                : 'bg-white border border-gray-200'
                            }`}
                          >
                            {player.name} {player.ready ? '✓' : ''}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <Button 
                  className="w-full" 
                  onClick={() => handleJoinRoom(selectedRoom.id)}
                  disabled={!player || 
                    (selectedRoom.players && selectedRoom.players.length >= selectedRoom.maxPlayers) ||
                    selectedRoom.status !== 'waiting'}
                >
                  {selectedRoom.status === 'waiting' ? 'Rejoindre cette salle' : 'Salle non disponible'}
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : null}
        
        {/* Available rooms list with refresh function */}
        <AvailableRooms 
          rooms={stableWaitingRooms}
          handleJoinRoom={handleJoinRoom}
          playerExists={!!player}
          selectedRoomId={selectedRoomId}
          onSelectRoom={handleSelectRoom}
          refreshRooms={refreshCurrentRoom}
        />
      </div>
      
      {/* Create room button - more visible at the bottom */}
      {!currentRoom && (
        <div className="p-6 pt-0">
          <Button 
            className="w-full py-6 text-lg" 
            onClick={() => setCreateDialogOpen(true)}
            disabled={!player}
          >
            <PlusCircle className="mr-2 h-5 w-5" /> Créer une nouvelle salle
          </Button>
        </div>
      )}
    </div>
  );
}
