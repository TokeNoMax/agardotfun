import React, { useRef, useEffect } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';

interface TouchControlAreaProps {
  onDirectionChange: (direction: { x: number; y: number } | null) => void;
}

const TouchControlArea: React.FC<TouchControlAreaProps> = ({ onDirectionChange }) => {
  const isMobile = useIsMobile();
  const touchAreaRef = useRef<HTMLDivElement>(null);
  const startTouchRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!isMobile || !touchAreaRef.current) return;

    const touchArea = touchAreaRef.current;

    const handleTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      if (e.touches.length > 0) {
        const touch = e.touches[0];
        const rect = touchArea.getBoundingClientRect();
        startTouchRef.current = {
          x: touch.clientX - rect.left,
          y: touch.clientY - rect.top
        };
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      if (e.touches.length > 0 && startTouchRef.current) {
        const touch = e.touches[0];
        const rect = touchArea.getBoundingClientRect();
        const currentX = touch.clientX - rect.left;
        const currentY = touch.clientY - rect.top;
        
        const deltaX = currentX - startTouchRef.current.x;
        const deltaY = currentY - startTouchRef.current.y;
        
        // Minimum movement threshold to avoid jitter
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        if (distance > 10) {
          // Normalize direction vector
          const normalizedDirection = {
            x: deltaX / distance,
            y: deltaY / distance
          };
          onDirectionChange(normalizedDirection);
        }
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      e.preventDefault();
      startTouchRef.current = null;
      // Keep the last direction instead of stopping
      // onDirectionChange(null);
    };

    // Double tap to stop
    let lastTapTime = 0;
    const handleDoubleTap = (e: TouchEvent) => {
      const currentTime = Date.now();
      if (currentTime - lastTapTime < 300) {
        onDirectionChange(null);
      }
      lastTapTime = currentTime;
    };

    touchArea.addEventListener('touchstart', handleTouchStart, { passive: false });
    touchArea.addEventListener('touchmove', handleTouchMove, { passive: false });
    touchArea.addEventListener('touchend', handleTouchEnd, { passive: false });
    touchArea.addEventListener('touchend', handleDoubleTap, { passive: false });

    return () => {
      touchArea.removeEventListener('touchstart', handleTouchStart);
      touchArea.removeEventListener('touchmove', handleTouchMove);
      touchArea.removeEventListener('touchend', handleTouchEnd);
      touchArea.removeEventListener('touchend', handleDoubleTap);
    };
  }, [isMobile, onDirectionChange]);

  if (!isMobile) return null;

  return (
    <div
      ref={touchAreaRef}
      className="absolute bottom-0 left-0 right-0 h-1/3 bg-gradient-to-t from-black/20 to-transparent border-t-2 border-white/20 flex flex-col items-center justify-center z-20"
      style={{ touchAction: 'none' }}
    >
      <div className="text-white/70 text-sm text-center mb-2">
        <div className="mb-1">Zone de Contrôle</div>
        <div className="text-xs">Glissez pour diriger • Double-tap pour arrêter</div>
      </div>
      <div className="w-16 h-16 rounded-full border-2 border-white/40 bg-white/10 flex items-center justify-center">
        <div className="w-8 h-8 rounded-full bg-white/60"></div>
      </div>
    </div>
  );
};

export default TouchControlArea;
