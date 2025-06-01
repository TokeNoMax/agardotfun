
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
      console.log("Refreshing all rooms...");
      const rooms = await gameRoomService.getAllRooms();
      console.log("Found rooms:", rooms.length);
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
      console.log("Refreshing current room:", currentRoomId);
      const room = await gameRoomService.getRoom(currentRoomId);
      if (room && !isUnmountedRef.current) {
        console.log("Current room data:", room);
        onRoomUpdate(room);
        
        // Vérifier si le jeu vient de démarrer
        if (room.status === 'playing') {
          console.log("Game started detected for room:", currentRoomId);
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

    // Créer un seul channel pour toutes les subscriptions
    const channel = supabase
      .channel('game_multiplayer_updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'game_rooms'
        },
        (payload) => {
          if (!isUnmountedRef.current) {
            console.log('Game rooms table changed:', payload.eventType, payload);
            // Rafraîchir après un court délai pour éviter les doublons
            setTimeout(() => {
              if (!isUnmountedRef.current) {
                refreshRooms();
                if (currentRoomId) {
                  refreshCurrentRoom();
                }
              }
            }, 100);
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
            console.log('Game room players table changed:', payload.eventType, payload);
            // Rafraîchir après un court délai pour éviter les doublons
            setTimeout(() => {
              if (!isUnmountedRef.current) {
                refreshRooms();
                if (currentRoomId) {
                  refreshCurrentRoom();
                }
              }
            }, 100);
          }
        }
      )
      .subscribe((status) => {
        console.log('Subscription status:', status);
        if (status === 'SUBSCRIBED') {
          console.log('Successfully subscribed to realtime updates');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('Error subscribing to realtime updates');
        }
      });

    channelRef.current = channel;

    // Charger les données initiales
    refreshRooms();
    if (currentRoomId) {
      refreshCurrentRoom();
    }

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
