
import { useGame } from "@/context/GameContext";
import AvailableRooms from "./AvailableRooms";
import CurrentRoom from "./CurrentRoom";
import { useState, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";

export default function RoomList() {
  const { currentRoom, player, rooms, joinRoom, refreshRooms } = useGame();
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const { toast } = useToast();

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

  return (
    <AvailableRooms 
      rooms={rooms}
      handleJoinRoom={handleJoinRoom}
      playerExists={!!player}
      selectedRoomId={selectedRoomId}
      onSelectRoom={handleSelectRoom}
      refreshRooms={refreshRooms}
    />
  );
}
