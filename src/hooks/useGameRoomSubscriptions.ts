
import { useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { GameRoom } from "@/types/game";
import { gameRoomService } from "@/services/gameRoomService";

interface UseGameRoomSubscriptionsProps {
  onRoomsUpdate: (rooms: GameRoom[]) => void;
  onRoomUpdate: (room: GameRoom) => void;
  onGameStarted: (room: GameRoom) => void;
  currentRoomId?: string;
}

export const useGameRoomSubscriptions = ({
  onRoomsUpdate,
  onRoomUpdate,
  onGameStarted,
  currentRoomId
}: UseGameRoomSubscriptionsProps) => {
  
  const refreshRooms = useCallback(async () => {
    try {
      const rooms = await gameRoomService.getAllRooms();
      onRoomsUpdate(rooms);
    } catch (error) {
      console.error("Error refreshing rooms:", error);
    }
  }, [onRoomsUpdate]);

  const refreshCurrentRoom = useCallback(async () => {
    if (!currentRoomId) return;
    
    try {
      const room = await gameRoomService.getRoom(currentRoomId);
      if (room) {
        onRoomUpdate(room);
        
        // Vérifier si le jeu vient de démarrer
        if (room.status === 'playing') {
          onGameStarted(room);
        }
      }
    } catch (error) {
      console.error("Error refreshing current room:", error);
    }
  }, [currentRoomId, onRoomUpdate, onGameStarted]);

  useEffect(() => {
    console.log("Setting up real-time subscriptions...");

    // Subscription pour les changements de salles
    const roomsChannel = supabase
      .channel('game_rooms_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'game_rooms'
        },
        (payload) => {
          console.log('Game rooms changed:', payload);
          refreshRooms();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'game_room_players'
        },
        (payload) => {
          console.log('Game room players changed:', payload);
          refreshRooms();
          if (currentRoomId) {
            refreshCurrentRoom();
          }
        }
      )
      .subscribe();

    // Charger les salles initiales
    refreshRooms();

    return () => {
      console.log("Cleaning up subscriptions...");
      supabase.removeChannel(roomsChannel);
    };
  }, [refreshRooms, refreshCurrentRoom, currentRoomId]);

  return {
    refreshRooms,
    refreshCurrentRoom
  };
};
