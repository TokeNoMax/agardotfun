
import { useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface ConnectionManagerOptions {
  roomId?: string;
  playerId?: string;
}

export const useConnectionManager = ({ roomId, playerId }: ConnectionManagerOptions) => {
  const activeChannelsRef = useRef<Set<string>>(new Set());
  const connectionStateRef = useRef<Map<string, any>>(new Map());

  const cleanupAllConnections = useCallback(() => {
    console.log('Cleaning up all connections...', Array.from(activeChannelsRef.current));
    
    // Supprimer tous les channels actifs
    supabase.getChannels().forEach(channel => {
      console.log('Removing channel:', channel.topic);
      supabase.removeChannel(channel);
    });
    
    // Nettoyer les références
    activeChannelsRef.current.clear();
    connectionStateRef.current.clear();
    
    console.log('All connections cleaned up');
  }, []);

  const createUniqueChannel = useCallback((channelName: string) => {
    // Nettoyer les anciens channels avec le même nom
    const existingChannels = supabase.getChannels().filter(ch => 
      ch.topic === channelName || ch.topic.includes(channelName)
    );
    
    existingChannels.forEach(ch => {
      console.log('Removing existing channel:', ch.topic);
      supabase.removeChannel(ch);
      activeChannelsRef.current.delete(ch.topic);
    });

    // Créer un nouveau channel avec un ID unique
    const uniqueChannelName = `${channelName}-${Date.now()}`;
    const channel = supabase.channel(uniqueChannelName);
    
    activeChannelsRef.current.add(uniqueChannelName);
    
    console.log('Created unique channel:', uniqueChannelName);
    return channel;
  }, []);

  const validateConnection = useCallback(async () => {
    if (!roomId || !playerId) return false;

    try {
      // Vérifier que le joueur est toujours dans la salle
      const { data: playerData, error } = await supabase
        .from('game_room_players')
        .select('room_id')
        .eq('room_id', roomId)
        .eq('player_id', playerId)
        .maybeSingle();

      if (error) {
        console.error('Connection validation error:', error);
        return false;
      }

      return !!playerData;
    } catch (error) {
      console.error('Connection validation failed:', error);
      return false;
    }
  }, [roomId, playerId]);

  const saveConnectionState = useCallback((key: string, state: any) => {
    connectionStateRef.current.set(key, {
      ...state,
      timestamp: Date.now()
    });
    
    // Sauvegarder dans localStorage pour récupération
    localStorage.setItem(`connection-state-${key}`, JSON.stringify({
      ...state,
      timestamp: Date.now()
    }));
  }, []);

  const restoreConnectionState = useCallback((key: string) => {
    // Essayer de récupérer depuis la mémoire d'abord
    let state = connectionStateRef.current.get(key);
    
    // Sinon, essayer localStorage
    if (!state) {
      const stored = localStorage.getItem(`connection-state-${key}`);
      if (stored) {
        try {
          state = JSON.parse(stored);
          // Vérifier que l'état n'est pas trop ancien (5 minutes max)
          if (Date.now() - state.timestamp > 5 * 60 * 1000) {
            localStorage.removeItem(`connection-state-${key}`);
            return null;
          }
        } catch (error) {
          console.error('Error parsing stored connection state:', error);
          localStorage.removeItem(`connection-state-${key}`);
          return null;
        }
      }
    }
    
    return state;
  }, []);

  return {
    cleanupAllConnections,
    createUniqueChannel,
    validateConnection,
    saveConnectionState,
    restoreConnectionState,
    activeChannels: activeChannelsRef.current
  };
};
