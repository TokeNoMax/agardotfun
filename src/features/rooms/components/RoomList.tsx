
import { useGame } from "@/context/GameContext";
import AvailableRooms from "./AvailableRooms";
import CurrentRoom from "./CurrentRoom";
import { useState, useCallback, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { gameRoomService } from "@/services/gameRoomService";

export default function RoomList() {
  const { currentRoom, player, rooms, joinRoom, refreshRooms } = useGame();
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const { toast } = useToast();

  // Use React Query to get rooms data (will use prefetched data if available)
  const { data: queryRooms, isLoading } = useQuery({
    queryKey: ['rooms'],
    queryFn: gameRoomService.getAllRooms,
    staleTime: 30000, // Consider data fresh for 30 seconds
    refetchInterval: 5000, // Refetch every 5 seconds for real-time updates
  });

  // Sync query data with game context
  useEffect(() => {
    if (queryRooms && queryRooms.length !== rooms.length) {
      // Update game context with query data if different
      refreshRooms();
    }
  }, [queryRooms, rooms.length, refreshRooms]);

  const handleJoinRoom = useCallback(async (roomId: string) => {
    if (!player) {
      toast({
        title: "Player Required",
        description: "Please configure your player first.",
        variant: "destructive",
      });
      return;
    }

    try {
      await joinRoom(roomId);
    } catch (error) {
      console.error("Error joining room:", error);
      toast({
        title: "Error",
        description: "Failed to join room. Please try again.",
        variant: "destructive",
      });
    }
  }, [player, joinRoom, toast]);

  const handleSelectRoom = useCallback((roomId: string) => {
    setSelectedRoomId(roomId);
  }, []);

  if (currentRoom && player) {
    return <CurrentRoom currentRoom={currentRoom} playerId={player.id} />;
  }

  // Use query data if available and context data as fallback
  const displayRooms = queryRooms || rooms;

  return (
    <AvailableRooms 
      rooms={displayRooms}
      handleJoinRoom={handleJoinRoom}
      playerExists={!!player}
      selectedRoomId={selectedRoomId}
      onSelectRoom={handleSelectRoom}
      refreshRooms={refreshRooms}
      isLoading={isLoading}
    />
  );
}
