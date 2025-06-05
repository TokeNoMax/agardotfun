
import { useEffect } from 'react';
import { ghostRoomCleaner } from '@/services/room/ghostRoomCleaner';

interface UseGhostRoomCleanerOptions {
  enabled?: boolean;
  intervalMinutes?: number;
}

export const useGhostRoomCleaner = ({
  enabled = true,
  intervalMinutes = 1
}: UseGhostRoomCleanerOptions = {}) => {
  
  useEffect(() => {
    if (enabled) {
      ghostRoomCleaner.startCleaning(intervalMinutes);
    }

    return () => {
      if (enabled) {
        ghostRoomCleaner.stopCleaning();
      }
    };
  }, [enabled, intervalMinutes]);

  return {
    forceCleanup: ghostRoomCleaner.forceCleanup.bind(ghostRoomCleaner)
  };
};
