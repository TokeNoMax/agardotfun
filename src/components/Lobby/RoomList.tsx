
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useGame } from "@/context/GameContext";
import { useToast } from "@/hooks/use-toast";
import { Player, GameRoom, GameMode } from "@/types/game";
import { Users, Crown, Play, Clock, Plus } from "lucide-react";
import CreateRoomDialog from "./CreateRoomDialog";

interface RoomListProps {
  rooms: GameRoom[];
  currentRoomId?: string;
  handleJoinRoom: (roomId: string) => Promise<void>;
  handleJoinGame: () => void;
}

export default function RoomList({ 
  rooms, 
  currentRoomId, 
  handleJoinRoom, 
  handleJoinGame 
}: RoomListProps) {
  const { player, currentRoom, refreshRooms, createRoom } = useGame();
  const { toast } = useToast();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [createRoomOpen, setCreateRoomOpen] = useState(false);
  const [roomName, setRoomName] = useState("");
  const [maxPlayers, setMaxPlayers] = useState("");

  // Auto-refresh rooms every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      refreshRooms();
    }, 5000);

    return () => clearInterval(interval);
  }, [refreshRooms]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshRooms();
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleCreateRoom = async (gameMode: GameMode = 'classic') => {
    if (!player) {
      toast({
        title: "Erreur",
        description: "Veuillez configurer votre joueur avant de créer une salle.",
        variant: "destructive"
      });
      return;
    }

    if (!roomName.trim() || !maxPlayers) {
      toast({
        title: "Champs requis",
        description: "Veuillez remplir tous les champs.",
        variant: "destructive"
      });
      return;
    }

    try {
      await createRoom(roomName.trim(), parseInt(maxPlayers), gameMode);
      setCreateRoomOpen(false);
      setRoomName("");
      setMaxPlayers("");
      toast({
        title: "Salle créée !",
        description: `La salle "${roomName}" a été créée avec succès.`,
      });
    } catch (error) {
      console.error("Error creating room:", error);
      toast({
        title: "Erreur",
        description: "Impossible de créer la salle. Veuillez réessayer.",
        variant: "destructive"
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'waiting': return 'text-cyber-green';
      case 'playing': return 'text-cyber-yellow';
      case 'finished': return 'text-gray-500';
      default: return 'text-cyber-cyan';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'waiting': return 'EN_ATTENTE';
      case 'playing': return 'EN_COURS';
      case 'finished': return 'TERMINÉ';
      default: return status.toUpperCase();
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-cyber-cyan font-mono">GAME_ROOMS</h2>
        <div className="flex items-center gap-2">
          <Button
            onClick={handleRefresh}
            disabled={isRefreshing}
            variant="outline"
            size="sm"
            className="font-mono border-cyber-cyan/50 text-cyber-cyan hover:bg-cyber-cyan/10"
          >
            {isRefreshing ? "SYNCING..." : "REFRESH"}
          </Button>
          
          <CreateRoomDialog
            open={createRoomOpen}
            onOpenChange={setCreateRoomOpen}
            roomName={roomName}
            setRoomName={setRoomName}
            maxPlayers={maxPlayers}
            setMaxPlayers={setMaxPlayers}
            handleCreateRoom={handleCreateRoom}
            playerExists={!!player}
          />
        </div>
      </div>

      {currentRoom && (
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-cyber-green/20 to-cyber-cyan/20 rounded-lg blur-xl"></div>
          <div className="relative bg-black/80 backdrop-blur-sm p-4 rounded-lg border-2 border-cyber-green/50">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center">
                <Crown className="h-5 w-5 text-cyber-yellow mr-2" />
                <h3 className="font-bold text-cyber-green font-mono">CURRENT_ROOM</h3>
              </div>
              <span className={`text-sm font-mono ${getStatusColor(currentRoom.status)}`}>
                {getStatusText(currentRoom.status)}
              </span>
            </div>
            
            <div className="space-y-2">
              <p className="text-cyber-cyan font-mono">
                <span className="text-gray-400">ROOM:</span> {currentRoom.name}
              </p>
              <p className="text-cyber-cyan font-mono">
                <span className="text-gray-400">PLAYERS:</span> {currentRoom.players.length}/{currentRoom.maxPlayers}
              </p>
              <p className="text-cyber-cyan font-mono">
                <span className="text-gray-400">MODE:</span> {currentRoom.gameMode || 'classic'}
              </p>
              
              {currentRoom.status === 'playing' && (
                <Button
                  onClick={handleJoinGame}
                  className="w-full bg-gradient-to-r from-cyber-green to-cyber-cyan text-black font-mono font-bold"
                >
                  <Play className="mr-2 h-4 w-4" />
                  JOIN_GAME
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {rooms.length === 0 ? (
          <div className="text-center py-8">
            <div className="bg-black/50 backdrop-blur-sm p-6 rounded-lg border border-cyber-cyan/30">
              <Clock className="h-12 w-12 text-cyber-cyan mx-auto mb-3 opacity-50" />
              <p className="text-gray-400 font-mono">Aucune salle disponible</p>
              <p className="text-gray-500 text-sm font-mono mt-1">
                Créez une nouvelle salle pour commencer à jouer
              </p>
            </div>
          </div>
        ) : (
          rooms.map((room) => (
            <div key={room.id} className="relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-cyber-cyan/10 to-cyber-magenta/10 rounded-lg blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <div className="relative bg-black/60 backdrop-blur-sm p-4 rounded-lg border border-cyber-cyan/30 group-hover:border-cyber-cyan/60 transition-all duration-300">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-bold text-cyber-cyan font-mono">{room.name}</h3>
                      <span className={`text-xs px-2 py-1 rounded font-mono ${getStatusColor(room.status)} bg-black/50`}>
                        {getStatusText(room.status)}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-4 text-sm text-gray-400 font-mono">
                      <div className="flex items-center">
                        <Users className="h-4 w-4 mr-1" />
                        {room.players.length}/{room.maxPlayers}
                      </div>
                      <div>MODE: {room.gameMode || 'classic'}</div>
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    {room.status === 'waiting' && room.id !== currentRoomId && (
                      <Button
                        onClick={() => handleJoinRoom(room.id)}
                        variant="outline"
                        size="sm"
                        className="font-mono border-cyber-green/50 text-cyber-green hover:bg-cyber-green/10"
                      >
                        JOIN
                      </Button>
                    )}
                    
                    {room.status === 'playing' && (
                      <Button
                        onClick={handleJoinGame}
                        variant="outline"
                        size="sm"
                        className="font-mono border-cyber-yellow/50 text-cyber-yellow hover:bg-cyber-yellow/10"
                      >
                        <Play className="h-4 w-4 mr-1" />
                        WATCH
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
