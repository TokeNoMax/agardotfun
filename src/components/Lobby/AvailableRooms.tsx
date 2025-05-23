
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
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { RefreshCw, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface AvailableRoomsProps {
  rooms: GameRoom[];
  handleJoinRoom: (roomId: string) => Promise<void>;
  playerExists: boolean;
  selectedRoomId: string | null;
  onSelectRoom: (roomId: string) => void;
  refreshRooms?: () => void;
}

export default function AvailableRooms({ 
  rooms, 
  handleJoinRoom, 
  playerExists, 
  selectedRoomId,
  onSelectRoom,
  refreshRooms
}: AvailableRoomsProps) {
  const [stableRooms, setStableRooms] = useState<GameRoom[]>(rooms);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [showDebug, setShowDebug] = useState(false);
  const { toast } = useToast();
  
  // Force refresh on mount pour s'assurer que les salles sont à jour
  useEffect(() => {
    if (refreshRooms) {
      const initialLoad = async () => {
        // Premier chargement
        await refreshRooms();
        
        // Second chargement après un court délai
        setTimeout(async () => {
          await refreshRooms();
          setLastRefresh(new Date());
          setIsLoading(false);
        }, 800);
      };
      
      initialLoad();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
  // Réagir immédiatement aux changements de rooms pour éviter les décalages
  useEffect(() => {
    console.log("AvailableRooms - rooms updated:", rooms.length);
    setStableRooms(rooms);
  }, [rooms]);

  // Fonction pour formater l'âge d'une salle
  const formatRoomAge = (createdAt: string) => {
    try {
      return formatDistanceToNow(new Date(createdAt), { 
        addSuffix: true,
        locale: fr 
      });
    } catch (e) {
      return "Date inconnue";
    }
  };

  // Fonction de rafraîchissement manuel
  const handleManualRefresh = async () => {
    if (refreshRooms && !isRefreshing) {
      setIsRefreshing(true);
      console.log("Rafraîchissement manuel - démarré");
      
      // Notification de début
      const toastId = toast({
        title: "Rafraîchissement",
        description: "Recherche des salles en cours..."
      }).id;
      
      try {
        // Premier rafraîchissement
        await refreshRooms();
        
        // Second rafraîchissement après un court délai
        setTimeout(async () => {
          if (refreshRooms) {
            await refreshRooms();
            setLastRefresh(new Date());
            setIsRefreshing(false);
            console.log("Rafraîchissement manuel - terminé");
            
            // Mettre à jour la notification
            toast({
              id: toastId,
              title: "Rafraîchissement terminé",
              description: `${rooms.length} salles trouvées.`
            });
          }
        }, 1000);
      } catch (error) {
        console.error("Erreur lors du rafraîchissement:", error);
        setIsRefreshing(false);
        
        // Notification d'erreur
        toast({
          id: toastId,
          title: "Erreur",
          description: "Impossible de rafraîchir les salles.",
          variant: "destructive"
        });
      }
    }
  };

  // Afficher l'état de chargement si les salles sont vides et chargement en cours
  if (isLoading && stableRooms.length === 0) {
    return (
      <div className="mb-4">
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-lg font-medium">Salles disponibles</h3>
          <Button
            variant="outline"
            size="icon"
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            title="Rafraîchir les salles"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
        <div className="text-center py-8 border rounded-md bg-gray-50">
          <p className="text-gray-500">Chargement des salles...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-4">
      <div className="flex justify-between items-center mb-2">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-medium">Salles disponibles ({stableRooms.length})</h3>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowDebug(!showDebug)}
            title="Afficher/cacher les informations de débogage"
            className="h-6 w-6"
          >
            <Info className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">
            Dernier rafraîchissement: {formatDistanceToNow(lastRefresh, {locale: fr, addSuffix: true})}
          </span>
          <Button
            variant="outline"
            size="icon"
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            title="Rafraîchir les salles"
            className="flex-shrink-0"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>
      {stableRooms.length > 0 ? (
        <div className="border rounded-md overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead>Joueurs</TableHead>
                <TableHead>Statut</TableHead>
                {showDebug && <TableHead>ID</TableHead>}
                <TableHead>Créée</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stableRooms.map((room) => (
                <TableRow 
                  key={room.id} 
                  className={selectedRoomId === room.id ? "bg-indigo-50 hover:bg-indigo-100" : ""}
                  onClick={() => onSelectRoom(room.id)}
                >
                  <TableCell className="font-medium">{room.name}</TableCell>
                  <TableCell>
                    {room.players && room.players.length}/{room.maxPlayers}
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
                  {showDebug && (
                    <TableCell className="text-xs text-gray-500">
                      <span title={room.id}>{room.id.substring(0, 6)}...</span>
                    </TableCell>
                  )}
                  <TableCell>
                    <span title={new Date(room.createdAt).toLocaleString()}>
                      {formatRoomAge(room.createdAt)}
                    </span>
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
            onClick={handleManualRefresh}
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
