
import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { useGame } from "@/context/GameContext";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import CreateRoomDialog from "./CreateRoomDialog";
import CurrentRoom from "./CurrentRoom";
import AvailableRooms from "./AvailableRooms";

export default function RoomList() {
  const { rooms, createRoom, joinRoom, player, currentRoom, startGame, leaveRoom, setPlayerReady, refreshCurrentRoom } = useGame();
  const [roomName, setRoomName] = useState("");
  const [maxPlayers, setMaxPlayers] = useState("4");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [gameStarting, setGameStarting] = useState(false);
  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();

  // Enhanced room filtering
  const waitingRooms = rooms ? rooms.filter(room => 
    room.status === 'waiting' && 
    (!currentRoom || room.id !== currentRoom.id) && 
    room.maxPlayers > 1 && // Filter out solo rooms
    !room.name.toLowerCase().includes('test_max_') // Filter out test rooms
  ) : [];

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
        await joinRoom(roomId);
      } catch (error) {
        console.error("Error creating room:", error);
      }
    }
  };

  const handleJoinRoom = async (roomId: string) => {
    await joinRoom(roomId);
  };

  const handleStartGame = async () => {
    try {
      setGameStarting(true);
      const success = await startGame();
      if (success) {
        // Ne pas naviguer automatiquement - attendre que l'utilisateur clique sur "Rejoindre la partie"
        toast({
          title: "Partie démarrée",
          description: "Cliquez sur 'Rejoindre la partie' quand vous êtes prêt",
          duration: 5000,
        });
      } else {
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

  const handleLeaveRoom = async () => {
    await leaveRoom();
    // Force refresh rooms après avoir quitté
    await refreshCurrentRoom();
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

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refreshCurrentRoom();
    setTimeout(() => setIsRefreshing(false), 500);
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

  return (
    <div className="w-full max-w-4xl bg-white rounded-lg shadow-lg p-6">
      <div className="flex justify-between items-center mb-6">
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
      ) : null}
      
      <AvailableRooms 
        rooms={waitingRooms}
        handleJoinRoom={handleJoinRoom}
        playerExists={!!player}
      />
    </div>
  );
}
