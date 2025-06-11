
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users, Zap, Crown, Target } from "lucide-react";

interface LobbyModeBarProps {
  activeMode: 'classic' | 'battle_royale';
  onModeChange: (mode: 'classic' | 'battle_royale') => void;
}

export default function LobbyModeBar({ activeMode, onModeChange }: LobbyModeBarProps) {
  return (
    <div className="w-full bg-black/90 backdrop-blur-sm rounded-lg border-2 border-cyber-cyan/50 shadow-[0_0_20px_rgba(0,255,255,0.2)] p-4 mb-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-cyber-cyan font-mono">GAME_MODES</h3>
        
        <div className="flex gap-3">
          <Button
            onClick={() => onModeChange('classic')}
            variant={activeMode === 'classic' ? 'default' : 'outline'}
            className={`font-mono font-bold ${
              activeMode === 'classic'
                ? 'bg-gradient-to-r from-cyber-green to-cyber-cyan text-black'
                : 'text-cyber-green border-cyber-green/50 hover:bg-cyber-green/10'
            }`}
          >
            <Users className="mr-2 h-4 w-4" />
            CLASSIC
            {activeMode === 'classic' && (
              <Badge className="ml-2 bg-cyber-green/20 text-cyber-green border-cyber-green/50">
                ACTIVE
              </Badge>
            )}
          </Button>
          
          <Button
            onClick={() => onModeChange('battle_royale')}
            variant={activeMode === 'battle_royale' ? 'default' : 'outline'}
            className={`font-mono font-bold ${
              activeMode === 'battle_royale'
                ? 'bg-gradient-to-r from-cyber-purple to-cyber-magenta text-white'
                : 'text-cyber-purple border-cyber-purple/50 hover:bg-cyber-purple/10'
            }`}
          >
            <Crown className="mr-2 h-4 w-4" />
            BATTLE_ROYALE
            {activeMode === 'battle_royale' && (
              <Badge className="ml-2 bg-cyber-purple/20 text-cyber-purple border-cyber-purple/50">
                ACTIVE
              </Badge>
            )}
          </Button>
        </div>
      </div>
      
      <div className="mt-3 text-sm text-gray-400 font-mono">
        {activeMode === 'classic' && (
          <p>
            <Target className="inline h-4 w-4 mr-1" />
            Mode classique : Survivez et grandissez en absorbant vos adversaires
          </p>
        )}
        {activeMode === 'battle_royale' && (
          <p>
            <Zap className="inline h-4 w-4 mr-1" />
            Battle Royale : Zone mortelle qui rétrécit + absorption des adversaires
          </p>
        )}
      </div>
    </div>
  );
}
