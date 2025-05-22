
import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RefreshCw } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useGame } from "@/context/GameContext";
import { useToast } from "@/components/ui/toast";
import { useNavigate } from "react-router-dom";

export default function RoomList() {
  const { rooms, createRoom, joinRoom, player, currentRoom, startGame, leaveRoom, setPlayerReady, refreshCurrentRoom } = useGame();
  const [roomName, setRoomName] = useState("");
  const [maxPlayers, setMaxPlayers] = useState("4");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();

  // Safely filter rooms with null check
  const waitingRooms = rooms ? rooms.filter(room => room.status === 'waiting') : [];

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
    if (countdown !== null && countdown > 0) {
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
            // Launch game automatically at the end of countdown
            startGame().then(() => {
              navigate('/game');
            }).catch(error => {
              console.error("Error starting game:", error);
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
  }, [countdown, navigate, startGame, toast]);

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
      await startGame();
      navigate('/game');
    } catch (error) {
      console.error("Error starting game:", error);
      toast({
        title: "Erreur",
        description: "Impossible de démarrer la partie",
        variant: "destructive"
      });
    }
  };

  const handleLeaveRoom = async () => {
    await leaveRoom();
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
          
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button disabled={!player || currentRoom !== null}>Créer une salle</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Créer une nouvelle salle</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">Nom de la salle</Label>
                  <Input
                    id="name"
                    placeholder="Entrer le nom de la salle"
                    value={roomName}
                    onChange={(e) => setRoomName(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="players">Joueurs maximum</Label>
                  <Select value={maxPlayers} onValueChange={setMaxPlayers}>
                    <SelectTrigger id="players">
                      <SelectValue placeholder="Sélectionnez le nombre de joueurs" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="2">2 Joueurs</SelectItem>
                      <SelectItem value="4">4 Joueurs</SelectItem>
                      <SelectItem value="6">6 Joueurs</SelectItem>
                      <SelectItem value="8">8 Joueurs</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleCreateRoom}>Créer</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
      
      {currentRoom ? (
        <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 mb-6">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-xl font-semibold">{currentRoom.name}</h3>
              <p className="text-gray-600">
                {currentRoom.players && currentRoom.players.length}/{currentRoom.maxPlayers} joueurs • {currentRoom.status === 'waiting' ? 'En attente' : currentRoom.status === 'playing' ? 'En cours' : 'Terminé'}
              </p>
              {countdown !== null && (
                <p className="text-lg font-bold text-green-600 mt-2">
                  Démarrage dans {countdown} secondes...
                </p>
              )}
              <div className="mt-2">
                <p className="text-sm font-medium">Joueurs:</p>
                <div className="flex flex-wrap gap-2 mt-1">
                  {currentRoom.players && currentRoom.players.map(player => (
                    <span 
                      key={player.id} 
                      className={`px-2 py-1 rounded text-sm ${player.ready ? 'bg-green-100 text-green-800' : 'bg-white'}`}
                    >
                      {player.name} {player.ready ? '✓' : ''}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <div className="space-y-2">
              {isCurrentPlayerInRoom() ? (
                <>
                  <Button 
                    onClick={handleToggleReady}
                    className="w-full"
                    variant={isCurrentPlayerReady() ? "outline" : "default"}
                  >
                    {isCurrentPlayerReady() ? "Annuler prêt" : "Je suis prêt"}
                  </Button>
                  <Button 
                    onClick={handleStartGame}
                    disabled={currentRoom.status !== 'waiting' || !currentRoom.players || currentRoom.players.length < 2 || !isCurrentPlayerReady()}
                    className="w-full"
                  >
                    Démarrer la partie
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={handleLeaveRoom}
                    className="w-full"
                  >
                    Quitter la salle
                  </Button>
                </>
              ) : (
                <Button 
                  onClick={() => handleJoinRoom(currentRoom.id)}
                  disabled={!currentRoom.players || currentRoom.players.length >= currentRoom.maxPlayers || currentRoom.status !== 'waiting'}
                  className="w-full"
                >
                  Rejoindre la salle
                </Button>
              )}
            </div>
          </div>
        </div>
      ) : waitingRooms.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-500">Aucune salle disponible. Créez-en une pour commencer à jouer !</p>
        </div>
      ) : (
        <div className="grid gap-4">
          <p className="text-sm text-gray-500 mb-2">Salles disponibles:</p>
          {waitingRooms.map((room) => (
            <div
              key={room.id}
              className="flex items-center justify-between p-4 border rounded-md hover:bg-gray-50 transition-colors"
            >
              <div>
                <h3 className="font-medium">{room.name}</h3>
                <p className="text-sm text-gray-500">
                  {room.players && room.players.length}/{room.maxPlayers} joueurs • En attente
                </p>
              </div>
              <Button 
                onClick={() => handleJoinRoom(room.id)}
                disabled={!player || (room.players && room.players.length >= room.maxPlayers)}
              >
                Rejoindre
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
