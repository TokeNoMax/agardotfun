
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
import { useState } from "react";
import { RefreshCw } from "lucide-react";
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
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { toast } = useToast();

  // Fonction de rafraîchissement simplifiée
  const handleRefresh = async () => {
    if (refreshRooms && !isRefreshing) {
      setIsRefreshing(true);
      
      try {
        await refreshRooms();
        console.log("Salles rafraîchies:", rooms.length);
        
        toast({
          title: "Rafraîchissement terminé",
          description: `${rooms.length} salles trouvées.`
        });
      } catch (error) {
        console.error("Erreur lors du rafraîchissement:", error);
        
        toast({
          title: "Erreur",
          description: "Impossible de rafraîchir les salles.",
          variant: "destructive"
        });
      } finally {
        setIsRefreshing(false);
      }
    }
  };

  return (
    <div className="mb-4">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-lg font-medium">Salles disponibles ({rooms.length})</h3>
        <Button
          variant="outline"
          size="icon"
          onClick={handleRefresh}
          disabled={isRefreshing}
          title="Rafraîchir les salles"
        >
          <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
        </Button>
      </div>
      
      {rooms && rooms.length > 0 ? (
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
              {rooms.map((room) => (
                <TableRow 
                  key={room.id} 
                  className={selectedRoomId === room.id ? "bg-indigo-50 hover:bg-indigo-100" : ""}
                  onClick={() => onSelectRoom(room.id)}
                >
                  <TableCell className="font-medium">{room.name}</TableCell>
                  <TableCell>
                    {room.players?.length || 0}/{room.maxPlayers}
                  </TableCell>
                  <TableCell>
                    {room.status === 'waiting' ? (
                      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                        En attente
                      </Badge>
                    ) : room.status === 'playing' ? (
                      <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                        En cours
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">
                        Terminée
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button 
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleJoinRoom(room.id);
                      }}
                      disabled={!playerExists || (room.players && room.players.length >= room.maxPlayers) || room.status !== 'waiting'}
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
          <Button 
            className="mt-4" 
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            {isRefreshing ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Rafraîchissement...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Rafraîchir
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
