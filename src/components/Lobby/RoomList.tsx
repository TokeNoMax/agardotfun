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
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useGame } from "@/context/GameContext";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

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
          
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button disabled={!player}>Créer une salle</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Créer une nouvelle salle</DialogTitle>
                <DialogDescription>
                  Créez votre propre salle de jeu et invitez d'autres joueurs à vous rejoindre
                </DialogDescription>
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
              {gameStarting && currentRoom.status === 'playing' && (
                <p className="text-lg font-bold text-green-600 mt-2">
                  La partie est prête ! Cliquez sur "Rejoindre la partie" pour commencer.
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
                    disabled={gameStarting}
                  >
                    {isCurrentPlayerReady() ? "Annuler prêt" : "Je suis prêt"}
                  </Button>
                  
                  {gameStarting && currentRoom.status === 'playing' ? (
                    <Button 
                      onClick={handleJoinGame}
                      className="w-full bg-green-600 hover:bg-green-700"
                    >
                      Rejoindre la partie
                    </Button>
                  ) : (
                    <Button 
                      onClick={handleStartGame}
                      disabled={currentRoom.status !== 'waiting' || !currentRoom.players || currentRoom.players.length < 2 || !isCurrentPlayerReady() || gameStarting}
                      className="w-full"
                    >
                      Démarrer la partie
                    </Button>
                  )}
                  
                  <Button 
                    variant="outline" 
                    onClick={handleLeaveRoom}
                    className="w-full"
                    disabled={gameStarting}
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
      ) : null}
      
      {/* Affichage des salles disponibles avec un tableau structuré */}
      <div className="mb-4">
        <h3 className="text-lg font-medium mb-2">Salles disponibles</h3>
        {waitingRooms.length > 0 ? (
          <div className="border rounded-md overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead>Joueurs</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {waitingRooms.map((room) => (
                  <TableRow key={room.id}>
                    <TableCell className="font-medium">{room.name}</TableCell>
                    <TableCell>
                      {room.players && room.players.length}/{room.maxPlayers}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                        En attente
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button 
                        size="sm"
                        onClick={() => handleJoinRoom(room.id)}
                        disabled={!player || (room.players && room.players.length >= room.maxPlayers)}
                      >
                        Rejoindre
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="text-center py-8 border rounded-md bg-gray-50">
            <p className="text-gray-500">Aucune salle disponible. Créez-en une pour commencer à jouer !</p>
          </div>
        )}
      </div>
    </div>
  );
}
