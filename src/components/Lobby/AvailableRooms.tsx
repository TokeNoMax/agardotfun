
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
import { RefreshCw } from "lucide-react";

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
  
  // Force refresh on mount pour s'assurer que les salles sont à jour
  useEffect(() => {
    if (refreshRooms) {
      refreshRooms();
      setLastRefresh(new Date());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
  // Use effect pour stabiliser les mises à jour des salles
  useEffect(() => {
    // Mise à jour immédiate pour les nouvelles salles
    setStableRooms(rooms);
    setIsLoading(false);
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

  // Fonction de rafraîchissement manuel avec une séquence de requêtes
  const handleManualRefresh = async () => {
    if (refreshRooms && !isRefreshing) {
      setIsRefreshing(true);
      
      // Premier rafraîchissement
      await refreshRooms();
      
      // Attendre un peu puis faire un second rafraîchissement pour s'assurer d'avoir les dernières données
      setTimeout(async () => {
        if (refreshRooms) {
          await refreshRooms();
          setLastRefresh(new Date());
          setIsRefreshing(false);
        }
      }, 1000);
    }
  };

  // Show loading state if rooms are empty and still loading
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

  // Filter out any remaining 'finished' rooms and test rooms before displaying
  const displayRooms = stableRooms.filter(room => 
    room.status !== 'finished' && 
    !room.name.toLowerCase().includes('test_') &&
    new Date(room.createdAt).getTime() > Date.now() - 30 * 60 * 1000 // Filtrer les salles créées il y a plus de 30 minutes
  );

  return (
    <div className="mb-4">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-lg font-medium">Salles disponibles</h3>
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
      <p className="text-sm text-gray-500 mb-2">Les salles inactives depuis plus de 30 minutes sont automatiquement supprimées.</p>
      {displayRooms.length > 0 ? (
        <div className="border rounded-md overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead>Joueurs</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Créée</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayRooms.map((room) => (
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
