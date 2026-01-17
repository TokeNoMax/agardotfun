import React from 'react';
import { Checkbox } from '@/components/ui/checkbox';

export interface NetworkPosition {
  x: number;
  y: number;
  size: number;
  timestamp: number;
}

export interface DebugDiagnostics {
  rtt: number;
  packetsSent: number;
  packetsReceived: number;
  snapshotsReceived?: number;
  inputsBuffered?: number;
}

interface DebugOverlayProps {
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  fps: number;
  connectionStatus: 'connected' | 'disconnected' | 'connecting';
  playerCount: number;
  diagnostics: DebugDiagnostics | null;
  networkQuality?: string;
}

export default function DebugOverlay({
  enabled,
  onToggle,
  fps,
  connectionStatus,
  playerCount,
  diagnostics,
  networkQuality = 'unknown'
}: DebugOverlayProps) {
  return (
    <>
      {/* Debug Toggle - Fixed top-right corner */}
      <div className="fixed top-4 right-20 z-50 flex items-center gap-2 bg-black/80 border border-green-500/50 rounded-lg px-3 py-2">
        <Checkbox
          id="debug-mode"
          checked={enabled}
          onCheckedChange={(checked) => onToggle(checked === true)}
          className="border-green-500 data-[state=checked]:bg-green-500"
        />
        <label 
          htmlFor="debug-mode" 
          className="text-green-400 text-sm font-mono cursor-pointer select-none"
        >
          🛠️ Debug
        </label>
      </div>

      {/* Debug Stats Panel - Top-left */}
      {enabled && (
        <div className="fixed top-20 left-4 z-50 bg-black/90 border border-green-500/50 rounded-lg p-4 font-mono text-xs min-w-[200px]">
          {/* Header */}
          <div className="flex items-center gap-2 mb-3 pb-2 border-b border-green-500/30">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-green-400 font-bold">DEBUG MODE</span>
          </div>
          
          {/* Performance Section */}
          <div className="space-y-2">
            <div className="text-gray-500 text-[10px] uppercase tracking-wider">Performance</div>
            
            {/* FPS */}
            <div className="flex justify-between items-center">
              <span className="text-gray-400">FPS:</span>
              <span className={`font-bold ${
                fps >= 55 ? 'text-green-400' : 
                fps >= 30 ? 'text-yellow-400' : 
                'text-red-400'
              }`}>
                {fps}
                {fps >= 55 && ' ✓'}
                {fps < 30 && ' ⚠'}
              </span>
            </div>
            
            {/* Connection Status */}
            <div className="flex justify-between items-center">
              <span className="text-gray-400">STATUS:</span>
              <span className={`font-bold ${
                connectionStatus === 'connected' ? 'text-green-400' : 
                connectionStatus === 'connecting' ? 'text-yellow-400' : 
                'text-red-400'
              }`}>
                {connectionStatus.toUpperCase()}
              </span>
            </div>
            
            {/* Players */}
            <div className="flex justify-between items-center">
              <span className="text-gray-400">PLAYERS:</span>
              <span className="text-blue-400 font-bold">{playerCount}</span>
            </div>
          </div>
          
          {/* Network Section */}
          {diagnostics && (
            <>
              <div className="my-3 border-t border-green-500/30" />
              <div className="space-y-2">
                <div className="text-gray-500 text-[10px] uppercase tracking-wider">Network</div>
                
                {/* RTT */}
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">RTT:</span>
                  <span className={`font-bold ${
                    diagnostics.rtt < 50 ? 'text-green-400' : 
                    diagnostics.rtt < 100 ? 'text-yellow-400' : 
                    'text-red-400'
                  }`}>
                    {diagnostics.rtt}ms
                  </span>
                </div>
                
                {/* Quality */}
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">QUALITY:</span>
                  <span className={`font-bold uppercase ${
                    networkQuality === 'excellent' ? 'text-green-400' : 
                    networkQuality === 'good' ? 'text-blue-400' : 
                    networkQuality === 'fair' ? 'text-yellow-400' : 
                    'text-red-400'
                  }`}>
                    {networkQuality}
                  </span>
                </div>
                
                {/* Packets */}
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">IN/OUT:</span>
                  <span className="text-purple-400 font-bold">
                    {diagnostics.packetsReceived}/{diagnostics.packetsSent}
                  </span>
                </div>
                
                {/* Snapshots */}
                {diagnostics.snapshotsReceived !== undefined && (
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">SNAPSHOTS:</span>
                    <span className="text-cyan-400 font-bold">{diagnostics.snapshotsReceived}</span>
                  </div>
                )}
                
                {/* Buffered Inputs */}
                {diagnostics.inputsBuffered !== undefined && (
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">INPUT BUF:</span>
                    <span className="text-orange-400 font-bold">{diagnostics.inputsBuffered}</span>
                  </div>
                )}
              </div>
            </>
          )}
          
          {/* Legend */}
          <div className="mt-4 pt-3 border-t border-green-500/30">
            <div className="text-gray-500 text-[10px] uppercase tracking-wider mb-2">Legend</div>
            <div className="flex items-center gap-2 text-[10px]">
              <span className="w-3 h-3 rounded-full border-2 border-red-500 border-dashed" />
              <span className="text-gray-400">Network Position</span>
            </div>
            <div className="flex items-center gap-2 text-[10px] mt-1">
              <span className="w-3 h-0.5 bg-red-500" />
              <span className="text-gray-400">Interpolation Offset</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
