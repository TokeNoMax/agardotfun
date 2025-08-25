import React, { useRef, useEffect, useState } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';

interface TouchControlAreaProps {
  onDirectionChange: (direction: { x: number; y: number } | null) => void;
  onBoostChange?: (isBoostActive: boolean) => void;
}

const TouchControlArea: React.FC<TouchControlAreaProps> = ({ onDirectionChange, onBoostChange }) => {
  const isMobile = useIsMobile();
  const touchAreaRef = useRef<HTMLDivElement>(null);
  const startTouchRef = useRef<{ x: number; y: number } | null>(null);
  const [currentDirection, setCurrentDirection] = useState<{ x: number; y: number } | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [isBoostActive, setIsBoostActive] = useState(false);

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
        setIsActive(true);
        console.log('TouchControlArea: Touch started at:', startTouchRef.current);
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
        if (distance > 15) {
          // Normalize direction vector
          const normalizedDirection = {
            x: deltaX / distance,
            y: deltaY / distance
          };
          
          console.log('TouchControlArea: Direction change:', normalizedDirection);
          setCurrentDirection(normalizedDirection);
          onDirectionChange(normalizedDirection);
        }
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      e.preventDefault();
      setIsActive(false);
      
      // Keep the last direction instead of stopping immediately
      // This allows for persistent movement
      console.log('TouchControlArea: Touch ended, keeping direction');
    };

    // Double tap to stop, long press for boost
    let lastTapTime = 0;
    const handleDoubleTap = (e: TouchEvent) => {
      const currentTime = Date.now();
      if (currentTime - lastTapTime < 300) {
        console.log('TouchControlArea: Double tap detected, stopping movement');
        setCurrentDirection(null);
        onDirectionChange(null);
        setIsActive(false);
      }
      lastTapTime = currentTime;
    };

    // Long press for boost
    let pressTimer: NodeJS.Timeout | null = null;
    const handleLongPressStart = (e: TouchEvent) => {
      pressTimer = setTimeout(() => {
        if (onBoostChange) {
          console.log('TouchControlArea: Long press detected, toggling boost');
          const newBoostState = !isBoostActive;
          setIsBoostActive(newBoostState);
          onBoostChange(newBoostState);
        }
      }, 500); // 500ms for long press
    };

    const handleLongPressEnd = () => {
      if (pressTimer) {
        clearTimeout(pressTimer);
        pressTimer = null;
      }
    };

    touchArea.addEventListener('touchstart', handleTouchStart, { passive: false });
    touchArea.addEventListener('touchstart', handleLongPressStart, { passive: false });
    touchArea.addEventListener('touchmove', handleTouchMove, { passive: false });
    touchArea.addEventListener('touchend', handleTouchEnd, { passive: false });
    touchArea.addEventListener('touchend', handleDoubleTap, { passive: false });
    touchArea.addEventListener('touchend', handleLongPressEnd, { passive: false });

    return () => {
      touchArea.removeEventListener('touchstart', handleTouchStart);
      touchArea.removeEventListener('touchstart', handleLongPressStart);
      touchArea.removeEventListener('touchmove', handleTouchMove);
      touchArea.removeEventListener('touchend', handleTouchEnd);
      touchArea.removeEventListener('touchend', handleDoubleTap);
      touchArea.removeEventListener('touchend', handleLongPressEnd);
    };
  }, [isMobile, onDirectionChange, onBoostChange, isBoostActive]);

  if (!isMobile) return null;

  return (
    <div
      ref={touchAreaRef}
      className={`absolute bottom-0 left-0 right-0 h-1/3 bg-gradient-to-t from-black/30 to-transparent border-t-2 ${
        isBoostActive ? 'border-orange-400' : isActive ? 'border-green-400' : 'border-white/20'
      } flex flex-col items-center justify-center z-20`}
      style={{ touchAction: 'none' }}
    >
      <div className="text-white/70 text-sm text-center mb-2">
        <div className="mb-1">Zone de Contrôle</div>
        <div className="text-xs">Glissez pour diriger • Double-tap pour arrêter • Appui long pour boost</div>
        {isBoostActive && (
          <div className="text-xs text-orange-400 animate-pulse">
            🚀 BOOST ACTIF
          </div>
        )}
        {currentDirection && (
          <div className="text-xs text-green-400">
            Direction: {Math.round(currentDirection.x * 100)}, {Math.round(currentDirection.y * 100)}
          </div>
        )}
      </div>
      <div className={`w-16 h-16 rounded-full border-2 ${
        isBoostActive ? 'border-orange-400 bg-orange-400/20' : isActive ? 'border-green-400 bg-green-400/20' : 'border-white/40 bg-white/10'
      } flex items-center justify-center transition-colors ${isBoostActive ? 'animate-pulse' : ''}`}>
        <div className={`w-8 h-8 rounded-full ${
          isBoostActive ? 'bg-orange-400' : isActive ? 'bg-green-400' : 'bg-white/60'
        } transition-colors`}></div>
        {currentDirection && (
          <div 
            className="absolute w-6 h-1 bg-green-400 rounded"
            style={{
              transform: `rotate(${Math.atan2(currentDirection.y, currentDirection.x) * 180 / Math.PI}deg)`
            }}
          />
        )}
      </div>
    </div>
  );
};

export default TouchControlArea;
