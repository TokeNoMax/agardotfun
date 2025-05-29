
import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface UseAutoCleanupOptions {
  intervalMinutes?: number;
  enableLogging?: boolean;
}

export const useAutoCleanup = (options: UseAutoCleanupOptions = {}) => {
  const { intervalMinutes = 5, enableLogging = true } = options;
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const triggerCleanup = async () => {
    if (enableLogging) {
      console.log('Déclenchement automatique du nettoyage amélioré...');
    }

    try {
      const { data, error } = await supabase.functions.invoke('cleanup-inactive-rooms', {
        body: { triggered_by: 'frontend_auto_enhanced' }
      });

      if (error) {
        console.error('Erreur lors du nettoyage automatique:', error);
        return;
      }

      if (enableLogging && (data?.cleaned > 0 || data?.ghostPlayersRemoved > 0)) {
        console.log(`Nettoyage automatique effectué:`, {
          sallesSuprimées: data.cleaned,
          sallesFantômes: data.ghostRoomsRemoved,
          sallesInactives: data.inactiveRoomsRemoved,
          joueursFantômesSuprimés: data.ghostPlayersRemoved,
          salles: data.roomNames
        });
      }

    } catch (error) {
      console.error('Erreur inattendue lors du nettoyage automatique:', error);
    }
  };

  useEffect(() => {
    // Premier nettoyage après 30 secondes pour nettoyer rapidement les salles fantômes
    const initialTimeout = setTimeout(() => {
      triggerCleanup();
    }, 30 * 1000);

    // Ensuite, nettoyage périodique plus fréquent (toutes les 5 minutes par défaut)
    intervalRef.current = setInterval(() => {
      triggerCleanup();
    }, intervalMinutes * 60 * 1000);

    if (enableLogging) {
      console.log(`Nettoyage automatique amélioré configuré: toutes les ${intervalMinutes} minutes`);
    }

    return () => {
      clearTimeout(initialTimeout);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [intervalMinutes, enableLogging]);

  return {
    triggerManualCleanup: triggerCleanup
  };
};
