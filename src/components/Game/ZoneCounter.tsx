
import React from 'react';
import { SafeZone } from '@/types/game';

interface ZoneCounterProps {
  safeZone: SafeZone;
  isPlayerInZone: boolean;
  timeUntilShrink: number; // in milliseconds
}

const ZoneCounter: React.FC<ZoneCounterProps> = ({ 
  safeZone, 
  isPlayerInZone, 
  timeUntilShrink 
}) => {
  // Convert milliseconds to MM:SS format
  const formatTime = (ms: number): string => {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  // Calculate zone size percentage
  const zonePercentage = Math.round((safeZone.currentRadius / safeZone.maxRadius) * 100);

  return (
    <div className="bg-black/80 backdrop-blur-sm p-4 rounded-lg shadow-lg text-white min-w-[200px]">
      <div className="text-center">
        <h3 className="text-lg font-bold mb-2 text-yellow-400">Zone Battle</h3>
        
        {/* Timer */}
        <div className="mb-2">
          <div className="text-sm text-gray-300">Prochain rétrécissement</div>
          <div className={`text-xl font-mono font-bold ${
            timeUntilShrink < 30000 ? 'text-red-400 animate-pulse' : 'text-white'
          }`}>
            {formatTime(timeUntilShrink)}
          </div>
        </div>

        {/* Zone size */}
        <div className="mb-2">
          <div className="text-sm text-gray-300">Taille de la zone</div>
          <div className={`text-lg font-bold ${
            zonePercentage < 30 ? 'text-red-400' : 
            zonePercentage < 60 ? 'text-yellow-400' : 'text-green-400'
          }`}>
            {zonePercentage}%
          </div>
        </div>

        {/* Player status */}
        <div className="flex items-center justify-center gap-2">
          <div className={`w-3 h-3 rounded-full ${
            isPlayerInZone ? 'bg-green-400' : 'bg-red-400 animate-pulse'
          }`}></div>
          <span className={`text-sm font-medium ${
            isPlayerInZone ? 'text-green-400' : 'text-red-400'
          }`}>
            {isPlayerInZone ? 'Zone Safe' : 'DANGER!'}
          </span>
        </div>

        {/* Damage warning */}
        {!isPlayerInZone && (
          <div className="mt-2 text-xs text-red-300 animate-pulse">
            -{safeZone.damagePerSecond} taille/sec
          </div>
        )}
      </div>
    </div>
  );
};

export default ZoneCounter;
