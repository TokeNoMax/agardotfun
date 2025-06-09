
import React from 'react';
import { SafeZone } from '@/types/game';
import { useIsMobile } from '@/hooks/use-mobile';

interface ZoneCounterProps {
  safeZone: SafeZone;
  isPlayerInZone: boolean;
  timeUntilShrink: number; // in milliseconds
  timeUntilDeath?: number; // in milliseconds - time until death if outside zone
}

const ZoneCounter: React.FC<ZoneCounterProps> = ({ 
  safeZone, 
  isPlayerInZone, 
  timeUntilShrink,
  timeUntilDeath = 0
}) => {
  const isMobile = useIsMobile();
  
  // Convert milliseconds to MM:SS format
  const formatTime = (ms: number): string => {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  // Calculate zone size percentage
  const zonePercentage = Math.round((safeZone.currentRadius / safeZone.maxRadius) * 100);

  if (isMobile) {
    // Compact mobile version
    return (
      <div className="bg-black/90 backdrop-blur-sm p-2 rounded-lg shadow-lg text-white min-w-[140px]">
        <div className="text-center">
          <h3 className="text-sm font-bold mb-1 text-yellow-400">Zone</h3>
          
          {/* Compact timer and zone info in one row */}
          <div className="flex justify-between items-center mb-1 text-xs">
            <div className="flex flex-col items-center">
              <span className="text-gray-300">Temps</span>
              <span className={`font-mono font-bold ${
                timeUntilShrink < 30000 ? 'text-red-400' : 'text-white'
              }`}>
                {formatTime(timeUntilShrink)}
              </span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-gray-300">Taille</span>
              <span className={`font-bold ${
                zonePercentage < 30 ? 'text-red-400' : 
                zonePercentage < 60 ? 'text-yellow-400' : 'text-green-400'
              }`}>
                {zonePercentage}%
              </span>
            </div>
          </div>

          {/* Player status with death timer */}
          <div className="flex items-center justify-center gap-1">
            <div className={`w-2 h-2 rounded-full ${
              isPlayerInZone ? 'bg-green-400' : 'bg-red-400 animate-pulse'
            }`}></div>
            <span className={`text-xs font-medium ${
              isPlayerInZone ? 'text-green-400' : 'text-red-400'
            }`}>
              {isPlayerInZone ? 'Safe' : 'DANGER'}
            </span>
          </div>

          {/* Death timer warning when outside zone */}
          {!isPlayerInZone && timeUntilDeath > 0 && (
            <div className="mt-1 text-xs text-red-300 animate-pulse">
              Mort dans: {formatTime(timeUntilDeath)}
            </div>
          )}

          {/* Damage warning */}
          {!isPlayerInZone && (
            <div className="mt-1 text-xs text-red-300 animate-pulse">
              -{safeZone.damagePerSecond}/s
            </div>
          )}
        </div>
      </div>
    );
  }

  // Desktop compact version
  return (
    <div className="bg-black/80 backdrop-blur-sm p-3 rounded-lg shadow-lg text-white min-w-[160px]">
      <div className="text-center">
        <h3 className="text-base font-bold mb-2 text-yellow-400">Zone Battle</h3>
        
        {/* Timer and zone size in horizontal layout */}
        <div className="flex justify-between items-center mb-2">
          <div className="text-center">
            <div className="text-xs text-gray-300">Prochain</div>
            <div className={`text-sm font-mono font-bold ${
              timeUntilShrink < 30000 ? 'text-red-400 animate-pulse' : 'text-white'
            }`}>
              {formatTime(timeUntilShrink)}
            </div>
          </div>
          
          <div className="text-center">
            <div className="text-xs text-gray-300">Zone</div>
            <div className={`text-sm font-bold ${
              zonePercentage < 30 ? 'text-red-400' : 
              zonePercentage < 60 ? 'text-yellow-400' : 'text-green-400'
            }`}>
              {zonePercentage}%
            </div>
          </div>
        </div>

        {/* Player status */}
        <div className="flex items-center justify-center gap-2">
          <div className={`w-2 h-2 rounded-full ${
            isPlayerInZone ? 'bg-green-400' : 'bg-red-400 animate-pulse'
          }`}></div>
          <span className={`text-sm font-medium ${
            isPlayerInZone ? 'text-green-400' : 'text-red-400'
          }`}>
            {isPlayerInZone ? 'Zone Safe' : 'DANGER!'}
          </span>
        </div>

        {/* Death timer warning when outside zone */}
        {!isPlayerInZone && timeUntilDeath > 0 && (
          <div className="mt-2 text-sm text-red-300 animate-pulse font-bold">
            ⚠️ Mort dans: {formatTime(timeUntilDeath)}
          </div>
        )}

        {/* Damage warning */}
        {!isPlayerInZone && (
          <div className="mt-1 text-xs text-red-300 animate-pulse">
            -{safeZone.damagePerSecond} taille/sec
          </div>
        )}
      </div>
    </div>
  );
};

export default ZoneCounter;
