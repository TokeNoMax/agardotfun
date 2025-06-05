
import { useEffect, useRef } from 'react';
import { snaps, getInterpolatedPosHermite } from '@/services/realtime/realtimeSync';

interface UseHermiteInterpolationProps {
  players: Record<string, any>;
  enabled: boolean;
}

export const useHermiteInterpolation = ({ players, enabled }: UseHermiteInterpolationProps) => {
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      return;
    }

    // ----  Rendu avec interpolation Hermite ----------
    function render() {
      for (const id in snaps) {
        const pos = getInterpolatedPosHermite(id);
        if (pos && players[id]) {
          players[id].setPos(pos.x, pos.y);
        }
      }
      animationFrameRef.current = requestAnimationFrame(render);
    }

    animationFrameRef.current = requestAnimationFrame(render);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [players, enabled]);

  return {
    isActive: !!animationFrameRef.current
  };
};
