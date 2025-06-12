
import { useState, useEffect } from 'react';
import { GameRoom } from '@/types/game';
import { gameRoomService } from '@/services/gameRoomService';
import { useGameRoomSubscriptions } from '@/hooks/useGameRoomSubscriptions';

export const useGameRooms = (currentRoomId?: string) => {
  const [rooms, setRooms] = useState<GameRoom[]>([]);

  const refreshRooms = async () => {
    try {
      console.log("Refreshing rooms...");
      const allRooms = await gameRoomService.getAllRooms();
      setRooms(allRooms);
    } catch (error) {
      console.error("Error refreshing rooms:", error);
    }
  };

  const { refreshCurrentRoom } = useGameRoomSubscriptions({
    onRoomsUpdate: setRooms,
    onRoomUpdate: () => {}, // Handled by GameContext
    onGameStarted: () => {}, // Handled by GameContext
    currentRoomId
  });

  useEffect(() => {
    refreshRooms();
  }, []);

  return {
    rooms,
    refreshRooms,
    refreshCurrentRoom
  };
};
