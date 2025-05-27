
import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface UseAutoCleanupOptions {
  intervalMinutes?: number;
  enableLogging?: boolean;
}

export const useAutoCleanup = (options: UseAutoCleanupOptions = {}) => {
  const { intervalMinutes = 15, enableLogging = true } = options;
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const triggerCleanup = async () => {
    if (enableLogging) {
      console.log('Déclenchement automatique du nettoyage des salles...');
    }

    try {
      const { data, error } = await supabase.functions.invoke('cleanup-inactive-rooms', {
        body: { triggered_by: 'frontend_auto' }
      });

      if (error) {
        console.error('Erreur lors du nettoyage automatique:', error);
        return;
      }

      if (enableLogging && data?.cleaned > 0) {
        console.log(`Nettoyage automatique: ${data.cleaned} salle(s) supprimée(s)`, data.roomNames);
      }

    } catch (error) {
      console.error('Erreur inattendue lors du nettoyage automatique:', error);
    }
  };

  useEffect(() => {
    // Premier nettoyage après 2 minutes pour éviter de surcharger au démarrage
    const initialTimeout = setTimeout(() => {
      triggerCleanup();
    }, 2 * 60 * 1000);

    // Ensuite, nettoyage périodique selon l'intervalle configuré
    intervalRef.current = setInterval(() => {
      triggerCleanup();
    }, intervalMinutes * 60 * 1000);

    if (enableLogging) {
      console.log(`Nettoyage automatique configuré: toutes les ${intervalMinutes} minutes`);
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
