
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

interface AvailableRoomsProps {
  rooms: GameRoom[];
  handleJoinRoom: (roomId: string) => Promise<void>;
  playerExists: boolean;
  selectedRoomId: string | null;
  onSelectRoom: (roomId: string) => void;
}

export default function AvailableRooms({ 
  rooms, 
  handleJoinRoom, 
  playerExists, 
  selectedRoomId,
  onSelectRoom 
}: AvailableRoomsProps) {
  // Add stabilization state with longer delay to prevent flickering
  const [stableRooms, setStableRooms] = useState<GameRoom[]>(rooms);
  const [isLoading, setIsLoading] = useState(true);
  
  // Use effect to stabilize room updates with a longer delay
  useEffect(() => {
    // Only update the stable rooms after a longer delay to prevent flickering
    const timer = setTimeout(() => {
      // Filter out rooms that have the same list of players to avoid unnecessary updates
      if (JSON.stringify(stableRooms.map(r => r.id).sort()) !== JSON.stringify(rooms.map(r => r.id).sort())) {
        setStableRooms(rooms);
      }
      setIsLoading(false);
    }, 500); // Longer delay to ensure stability
    
    return () => clearTimeout(timer);
  }, [rooms]);

  // Show loading state if rooms are empty and still loading
  if (isLoading && stableRooms.length === 0) {
    return (
      <div className="mb-4">
        <h3 className="text-lg font-medium mb-2">Salles disponibles</h3>
        <div className="text-center py-8 border rounded-md bg-gray-50">
          <p className="text-gray-500">Chargement des salles...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-4">
      <h3 className="text-lg font-medium mb-2">Salles disponibles</h3>
      {stableRooms.length > 0 ? (
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
                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                      En attente
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button 
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleJoinRoom(room.id);
                      }}
                      disabled={!playerExists || (room.players && room.players.length >= room.maxPlayers)}
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
  );
}
