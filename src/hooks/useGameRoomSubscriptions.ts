
import { useEffect, useCallback, useRef } from "react";
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
  const isUnmountedRef = useRef(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  
  const refreshRooms = useCallback(async () => {
    if (isUnmountedRef.current) return;
    
    try {
      const rooms = await gameRoomService.getAllRooms();
      if (!isUnmountedRef.current) {
        onRoomsUpdate(rooms);
      }
    } catch (error) {
      if (!isUnmountedRef.current) {
        console.error("Error refreshing rooms:", error);
      }
    }
  }, [onRoomsUpdate]);

  const refreshCurrentRoom = useCallback(async () => {
    if (!currentRoomId || isUnmountedRef.current) return;
    
    try {
      const room = await gameRoomService.getRoom(currentRoomId);
      if (room && !isUnmountedRef.current) {
        onRoomUpdate(room);
        
        // Vérifier si le jeu vient de démarrer
        if (room.status === 'playing') {
          onGameStarted(room);
        }
      }
    } catch (error) {
      if (!isUnmountedRef.current) {
        console.error("Error refreshing current room:", error);
      }
    }
  }, [currentRoomId, onRoomUpdate, onGameStarted]);

  // Fonction pour nettoyer immédiatement les subscriptions
  const cleanupSubscriptions = useCallback(() => {
    console.log("Cleaning up subscriptions immediately...");
    isUnmountedRef.current = true;
    
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
  }, []);

  useEffect(() => {
    isUnmountedRef.current = false;
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
          if (!isUnmountedRef.current) {
            console.log('Game rooms changed:', payload);
            refreshRooms();
          }
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
          if (!isUnmountedRef.current) {
            console.log('Game room players changed:', payload);
            refreshRooms();
            if (currentRoomId) {
              refreshCurrentRoom();
            }
          }
        }
      )
      .subscribe();

    channelRef.current = roomsChannel;

    // Charger les salles initiales
    refreshRooms();

    return () => {
      cleanupSubscriptions();
    };
  }, [refreshRooms, refreshCurrentRoom, currentRoomId, cleanupSubscriptions]);

  return {
    refreshRooms,
    refreshCurrentRoom,
    cleanupSubscriptions
  };
};
