
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
import { RefreshCw, AlertCircle, WifiOff } from "lucide-react";
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
  const [connectionError, setConnectionError] = useState(false);
  const { toast } = useToast();
  
  // Afficher les salles dans la console à chaque fois que rooms change
  useEffect(() => {
    console.log("AvailableRooms - Rooms actualisées:", rooms);
    if (Array.isArray(rooms)) {
      console.log(`Nombre de salles: ${rooms.length}`);
      if (rooms.length > 0) {
        console.log("Première salle:", rooms[0]);
        // Si nous recevons des salles valides, réinitialiser l'état d'erreur de connexion
        setConnectionError(false);
      }
    } else {
      console.log("rooms n'est pas un tableau:", rooms);
    }
  }, [rooms]);

  const handleRefresh = async () => {
    if (!refreshRooms || isRefreshing) return;
    
    console.log("Début du rafraîchissement manuel des salles");
    setIsRefreshing(true);
    setConnectionError(false);
    
    try {
      await refreshRooms();
      console.log("Rafraîchissement terminé, salles:", rooms);
      toast({
        title: "Rafraîchissement terminé",
        description: `${Array.isArray(rooms) ? rooms.length : 0} salles disponibles.`
      });
    } catch (error) {
      console.error("Erreur de rafraîchissement:", error);
      setConnectionError(true);
      toast({
        title: "Erreur de connexion",
        description: "Impossible de se connecter au serveur de jeu. Veuillez réessayer plus tard.",
        variant: "destructive"
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  // Garantir que rooms est toujours traité comme un tableau
  const roomsToDisplay = Array.isArray(rooms) ? rooms : [];
  
  console.log("Rendu de AvailableRooms avec", roomsToDisplay.length, "salles");

  return (
    <div className="mb-4">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-lg font-medium">Salles disponibles ({roomsToDisplay.length})</h3>
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
      
      {/* Afficher une alerte en cas d'erreur de connexion */}
      {connectionError && (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Problème de connexion</AlertTitle>
          <AlertDescription>
            Impossible de se connecter au serveur de jeu. Cela peut être dû à:
            <ul className="list-disc pl-5 mt-2">
              <li>Un problème temporaire de serveur</li>
              <li>Une interruption de votre connexion internet</li>
              <li>Un problème d'hébergement</li>
            </ul>
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
              {roomsToDisplay.map((room) => (
                <TableRow 
                  key={room.id} 
                  className={selectedRoomId === room.id ? "bg-indigo-50 hover:bg-indigo-100" : ""}
                  onClick={() => onSelectRoom(room.id)}
                >
                  <TableCell className="font-medium">{room.name || "Salle sans nom"}</TableCell>
                  <TableCell>
                    {(room.players?.length || 0)}/{room.maxPlayers || 4}
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
                      disabled={!playerExists || (room.players && room.players.length >= (room.maxPlayers || 4)) || room.status !== 'waiting'}
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
          {connectionError ? (
            <div className="flex flex-col items-center justify-center">
              <WifiOff className="h-12 w-12 text-red-500 mb-4" />
              <p className="text-gray-700 font-medium">Problème de connexion au serveur</p>
              <p className="text-gray-500 mt-2">Impossible de récupérer les salles disponibles.</p>
              <Button 
                className="mt-4" 
                onClick={handleRefresh}
                disabled={isRefreshing}
              >
                {isRefreshing ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Nouvelle tentative...
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
                    Rafraîchissement...
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Rafraîchir
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
