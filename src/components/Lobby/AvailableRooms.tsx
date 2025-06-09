
import { Button } from "@/components/ui/button";
import { GameRoom } from "@/types/game";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useState, useEffect } from "react";
import { RefreshCw, AlertCircle, CheckCircle, Users, Zap } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface AvailableRoomsProps {
  rooms: GameRoom[];
  handleJoinRoom: (roomId: string) => Promise<void>;
  playerExists: boolean;
  selectedRoomId: string | null;
  onSelectRoom: (roomId: string) => void;
  refreshRooms?: () => Promise<void>;
}

export default function AvailableRooms({ 
  rooms, 
  handleJoinRoom, 
  playerExists, 
  selectedRoomId,
  onSelectRoom,
  refreshRooms
}: AvailableRoomsProps) {
  const [hasSuccessfulConnection, setHasSuccessfulConnection] = useState(false);
  const { toast } = useToast();
  
  useEffect(() => {
    console.log("AvailableRooms - Rooms updated:", rooms);
    if (Array.isArray(rooms) && rooms.length >= 0) {
      console.log(`Number of rooms: ${rooms.length}`);
      setHasSuccessfulConnection(true);
      if (rooms.length > 0) {
        console.log("First room:", rooms[0]);
      }
    } else {
      console.log("rooms is not an array:", rooms);
    }
  }, [rooms]);

  // Fonction pour déterminer le statut d'affichage d'une salle
  const getRoomDisplayStatus = (room: GameRoom) => {
    const playerCount = room.players?.length || 0;
    
    if (room.status === 'playing') {
      return { 
        text: 'En cours', 
        variant: 'outline' as const, 
        className: 'bg-amber-50 text-amber-700 border-amber-200' 
      };
    }
    
    if (room.status === 'finished') {
      return { 
        text: 'Terminée', 
        variant: 'outline' as const, 
        className: 'bg-gray-50 text-gray-700 border-gray-200' 
      };
    }
    
    if (playerCount === 0) {
      return { 
        text: 'Vide', 
        variant: 'outline' as const, 
        className: 'bg-blue-50 text-blue-700 border-blue-200' 
      };
    }
    
    return { 
      text: 'En attente', 
      variant: 'outline' as const, 
      className: 'bg-green-50 text-green-700 border-green-200' 
    };
  };

  const handleContextualRefresh = async () => {
    if (!refreshRooms) return;
    
    try {
      await refreshRooms();
      toast({
        title: "ROOMS_REFRESHED",
        description: `${Array.isArray(rooms) ? rooms.length : 0} salles trouvées.`
      });
    } catch (error) {
      console.error("Error during refresh:", error);
      setHasSuccessfulConnection(false);
      toast({
        title: "CONNECTION_ERROR",
        description: "Impossible de récupérer les salles. Vérifiez votre connexion.",
        variant: "destructive"
      });
    }
  };

  const roomsToDisplay = Array.isArray(rooms) ? rooms : [];
  
  console.log("Rendering AvailableRooms with", roomsToDisplay.length, "rooms");

  return (
    <div className="mb-4">
      <div className="mb-4">
        <h3 className="text-xl font-bold text-cyber-cyan font-mono">AVAILABLE_ROOMS ({roomsToDisplay.length})</h3>
      </div>
      
      {/* Connection status indicator */}
      {hasSuccessfulConnection && (
        <Alert className="mb-4 border-cyber-green/30 bg-cyber-green/10">
          <CheckCircle className="h-4 w-4 text-cyber-green" />
          <AlertTitle className="text-cyber-green font-mono">SUPABASE_CONNECTED</AlertTitle>
          <AlertDescription className="text-cyber-green font-mono">
            Connexion réussie au système de salles de jeu.
          </AlertDescription>
        </Alert>
      )}
      
      {roomsToDisplay.length > 0 ? (
        <div className="border border-cyber-cyan/30 rounded-lg overflow-hidden bg-black/50 backdrop-blur-sm">
          <Table>
            <TableHeader>
              <TableRow className="border-cyber-cyan/30">
                <TableHead className="text-cyber-cyan font-mono">MATCH</TableHead>
                <TableHead className="text-cyber-cyan font-mono">PLAYERS</TableHead>
                <TableHead className="text-cyber-cyan font-mono">STATUS</TableHead>
                <TableHead className="text-right text-cyber-cyan font-mono">ACTION</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {roomsToDisplay.map((room) => {
                const playerCount = room.players?.length || 0;
                const statusInfo = getRoomDisplayStatus(room);
                const isEmpty = playerCount === 0;
                
                return (
                  <TableRow 
                    key={room.id} 
                    className={`border-cyber-cyan/20 hover:bg-cyber-cyan/5 transition-colors ${
                      selectedRoomId === room.id ? "bg-cyber-cyan/10" : ""
                    }`}
                    onClick={() => onSelectRoom(room.id)}
                  >
                    <TableCell className="font-medium text-gray-300 font-mono">
                      <div className="flex items-center gap-2">
                        <span className="text-cyber-cyan font-bold">Match #{room.matchNumber}</span>
                        <span className="text-gray-400">- {room.name || "UNNAMED_ROOM"}</span>
                        {isEmpty && (
                          <Users className="h-4 w-4 text-cyber-blue animate-pulse" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono">
                      <span className={isEmpty ? 'text-cyber-blue font-bold' : 'text-gray-300'}>
                        {playerCount}/{room.maxPlayers || 4}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant="outline" 
                        className={`font-mono ${statusInfo.className} border`}
                      >
                        {statusInfo.text}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button 
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleJoinRoom(room.id);
                        }}
                        disabled={!playerExists || (room.players && room.players.length >= (room.maxPlayers || 4)) || room.status !== 'waiting'}
                        className={`font-mono font-bold ${isEmpty 
                          ? 'bg-gradient-to-r from-cyber-blue to-cyber-cyan hover:from-cyber-cyan hover:to-cyber-blue text-black border border-cyber-blue/50' 
                          : 'bg-gradient-to-r from-cyber-green to-cyber-cyan hover:from-cyber-cyan hover:to-cyber-green text-black border border-cyber-green/50'
                        }`}
                      >
                        <Zap className="mr-1 h-3 w-3" />
                        {isEmpty ? 'JOIN_EMPTY' : 'JOIN_ROOM'}
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="text-center py-8 border border-cyber-cyan/30 rounded-lg bg-black/50 backdrop-blur-sm">
          {!hasSuccessfulConnection ? (
            <div className="flex flex-col items-center justify-center">
              <AlertCircle className="h-12 w-12 text-cyber-yellow mb-4 animate-pulse" />
              <p className="text-cyber-yellow font-bold font-mono">CONNECTION_INITIALIZING...</p>
              <p className="text-gray-400 mt-2 font-mono">Connexion au système de salles de jeu.</p>
              <Button 
                className="mt-4 bg-gradient-to-r from-cyber-yellow to-cyber-orange hover:from-cyber-orange hover:to-cyber-yellow text-black font-mono font-bold" 
                onClick={handleContextualRefresh}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                RETRY_CONNECTION
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-col items-center">
                <Users className="h-12 w-12 text-cyber-cyan mb-4 animate-pulse" />
                <p className="text-gray-400 font-mono">NO_ROOMS_AVAILABLE</p>
                <p className="text-gray-500 text-sm font-mono mt-1">Créez une salle pour commencer à jouer !</p>
              </div>
              <Button 
                className="bg-gradient-to-r from-cyber-cyan to-cyber-magenta hover:from-cyber-magenta hover:to-cyber-cyan text-black font-mono font-bold" 
                onClick={handleContextualRefresh}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                SCAN_ROOMS
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
