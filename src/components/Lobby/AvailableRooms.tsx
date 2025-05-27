
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
import { useState, useEffect } from "react";
import { RefreshCw, AlertCircle, CheckCircle, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

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

  const handleRefresh = async () => {
    if (!refreshRooms || isRefreshing) return;
    
    console.log("Manual refresh started");
    setIsRefreshing(true);
    
    try {
      await refreshRooms();
      console.log("Refresh completed, rooms:", rooms);
      toast({
        title: "Actualisé",
        description: `${Array.isArray(rooms) ? rooms.length : 0} salles trouvées.`
      });
    } catch (error) {
      console.error("Error during refresh:", error);
      setHasSuccessfulConnection(false);
      toast({
        title: "Erreur de connexion",
        description: "Impossible de récupérer les salles. Vérifiez votre connexion.",
        variant: "destructive"
      });
    } finally {
      setIsRefreshing(false);
    }
  };

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

  const roomsToDisplay = Array.isArray(rooms) ? rooms : [];
  
  console.log("Rendering AvailableRooms with", roomsToDisplay.length, "rooms");

  return (
    <div className="mb-4">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-lg font-medium">Salles disponibles ({roomsToDisplay.length})</h3>
        <Button
          variant="outline"
          size="icon"
          onClick={handleRefresh}
          disabled={isRefreshing}
          title="Actualiser les salles"
        >
          <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
        </Button>
      </div>
      
      {/* Indicateur de statut de connexion */}
      {hasSuccessfulConnection && (
        <Alert className="mb-4 border-green-200 bg-green-50">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertTitle className="text-green-800">Connecté à Supabase</AlertTitle>
          <AlertDescription className="text-green-700">
            Connexion réussie au système de salles de jeu.
          </AlertDescription>
        </Alert>
      )}
      
      {roomsToDisplay.length > 0 ? (
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
              {roomsToDisplay.map((room) => {
                const playerCount = room.players?.length || 0;
                const statusInfo = getRoomDisplayStatus(room);
                const isEmpty = playerCount === 0;
                
                return (
                  <TableRow 
                    key={room.id} 
                    className={selectedRoomId === room.id ? "bg-indigo-50 hover:bg-indigo-100" : ""}
                    onClick={() => onSelectRoom(room.id)}
                  >
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {room.name || "Salle sans nom"}
                        {isEmpty && (
                          <Users className="h-4 w-4 text-blue-500" title="Salle vide - vous pouvez la rejoindre" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className={isEmpty ? 'text-blue-600 font-medium' : ''}>
                        {playerCount}/{room.maxPlayers || 4}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusInfo.variant} className={statusInfo.className}>
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
                        className={isEmpty ? 'bg-blue-600 hover:bg-blue-700' : ''}
                      >
                        {isEmpty ? 'Rejoindre (vide)' : 'Rejoindre'}
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="text-center py-8 border rounded-md bg-gray-50">
          {!hasSuccessfulConnection ? (
            <div className="flex flex-col items-center justify-center">
              <AlertCircle className="h-12 w-12 text-amber-500 mb-4" />
              <p className="text-gray-700 font-medium">Connexion en cours...</p>
              <p className="text-gray-500 mt-2">Connexion au système de salles de jeu.</p>
              <Button 
                className="mt-4" 
                onClick={handleRefresh}
                disabled={isRefreshing}
              >
                {isRefreshing ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Connexion...
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Réessayer
                  </>
                )}
              </Button>
            </div>
          ) : (
            <>
              <p className="text-gray-500">Aucune salle disponible. Créez-en une pour commencer à jouer !</p>
              <Button 
                className="mt-4" 
                onClick={handleRefresh}
                disabled={isRefreshing}
              >
                {isRefreshing ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Actualisation...
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Actualiser
                  </>
                )}
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
