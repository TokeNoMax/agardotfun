
import { useEffect, useState } from 'react';
import { Progress } from '@/components/ui/progress';

interface GameStartCountdownProps {
  countdown: number;
  gameStarting: boolean;
}

export default function GameStartCountdown({ countdown, gameStarting }: GameStartCountdownProps) {
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    if (countdown > 0) {
      // Calculate progress based on countdown (assuming max countdown is 5 seconds)
      const maxCountdown = 5;
      const progressValue = ((maxCountdown - countdown) / maxCountdown) * 100;
      setProgress(progressValue);
    }
  }, [countdown]);

  if (gameStarting) {
    return (
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center">
        <div className="text-center">
          <div className="relative mb-6">
            <div className="absolute inset-0 bg-gradient-to-r from-cyber-green/30 to-cyber-cyan/30 rounded-full blur-xl animate-pulse"></div>
            <div className="relative bg-black/90 border-2 border-cyber-green rounded-full p-8 shadow-[0_0_30px_rgba(0,255,255,0.5)]">
              <div className="text-6xl font-mono font-bold text-cyber-green animate-pulse">
                🚀
              </div>
            </div>
          </div>
          <h2 className="text-3xl font-mono font-bold text-cyber-green mb-2 animate-pulse">
            LAUNCHING_GAME...
          </h2>
          <p className="text-lg text-cyber-cyan font-mono">
            Navigation automatique en cours !
          </p>
        </div>
      </div>
    );
  }

  if (countdown > 0) {
    return (
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center">
        <div className="text-center">
          <div className="relative mb-6">
            <div className="absolute inset-0 bg-gradient-to-r from-cyber-magenta/30 to-cyber-purple/30 rounded-full blur-xl animate-pulse"></div>
            <div className="relative bg-black/90 border-4 border-cyber-magenta rounded-full w-32 h-32 flex items-center justify-center shadow-[0_0_40px_rgba(255,0,255,0.6)]">
              <span className="text-6xl font-mono font-bold text-cyber-magenta animate-bounce">
                {countdown}
              </span>
            </div>
          </div>
          
          <h2 className="text-4xl font-mono font-bold text-cyber-magenta mb-4 animate-pulse">
            GAME_STARTING
          </h2>
          
          <div className="w-80 mb-4">
            <Progress 
              value={progress} 
              className="h-3 bg-black/50 border border-cyber-purple/50"
            />
          </div>
          
          <p className="text-lg text-cyber-cyan font-mono">
            Préparez-vous à entrer dans la matrice...
          </p>
        </div>
      </div>
    );
  }

  return null;
}
