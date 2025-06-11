
import { Player } from "@/types/game";
import { Target, Clock, Zap } from "lucide-react";
import VictoryMessage from "@/features/game/components/VictoryMessage";

interface VictoryDisplayProps {
  winner: Player | null;
  gameMode: 'multiplayer' | 'zone' | 'local';
  gameDuration: number;
  finalSize?: number;
  eliminationType: 'absorption' | 'zone' | 'timeout';
  showConfetti: boolean;
}

export default function VictoryDisplay({
  winner,
  gameMode,
  gameDuration,
  finalSize,
  eliminationType,
  showConfetti
}: VictoryDisplayProps) {
  // Format game duration
  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  // Safe name display with fallback
  const getDisplayName = (player: Player | null) => {
    if (!player) return "Joueur Inconnu";
    return player.name || "Joueur Sans Nom";
  };

  // Safe initials with fallback
  const getPlayerInitials = (player: Player | null) => {
    if (!player || !player.name) return "??";
    return player.name.substring(0, 2).toUpperCase();
  };

  // Helper function to get color hex
  const getColorHex = (color: string): string => {
    const colorMap: Record<string, string> = {
      blue: '3498db',
      red: 'e74c3c',
      green: '2ecc71',
      yellow: 'f1c40f',
      purple: '9b59b6',
      orange: 'e67e22',
      cyan: '1abc9c',
      pink: 'fd79a8'
    };
    return colorMap[color] || '3498db';
  };

  if (!winner) {
    return (
      <div className="text-center py-6">
        <p className="text-xl mb-4">🤝</p>
        <p className="text-lg">La partie s'est terminée sans vainqueur</p>
        {gameDuration > 0 && (
          <p className="text-sm text-muted-foreground mt-2">
            Durée: {formatDuration(gameDuration)}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center py-6">
      <div 
        className={`w-24 h-24 rounded-full mb-4 bg-game-${winner.color || 'blue'} flex items-center justify-center relative ${
          showConfetti ? 'animate-pulse' : ''
        }`}
        style={{ backgroundColor: `#${getColorHex(winner.color || 'blue')}` }}
      >
        {winner.nftImageUrl ? (
          <img 
            src={winner.nftImageUrl} 
            alt={getDisplayName(winner)}
            className="w-full h-full rounded-full object-cover"
          />
        ) : (
          <span className="text-white font-bold text-2xl">
            {getPlayerInitials(winner)}
          </span>
        )}
        {/* Winner glow effect */}
        <div className="absolute inset-0 rounded-full bg-yellow-400/20 animate-pulse"></div>
      </div>
      
      <div className="text-center">
        <VictoryMessage 
          winner={winner}
          gameMode={gameMode}
          eliminationType={eliminationType}
        />
        
        {/* Victory Stats */}
        <div className="grid grid-cols-2 gap-4 my-4 p-4 bg-black/10 rounded-lg">
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-sm text-muted-foreground">
              <Target className="w-4 h-4" />
              Taille finale
            </div>
            <div className="font-bold text-lg">
              {finalSize ? Math.round(finalSize) : Math.round(winner.size || 0)}
            </div>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-sm text-muted-foreground">
              <Clock className="w-4 h-4" />
              Durée
            </div>
            <div className="font-bold text-lg">
              {formatDuration(gameDuration)}
            </div>
          </div>
        </div>
        
        <p className="text-sm text-muted-foreground mt-2 flex items-center justify-center gap-1">
          <Zap className="w-4 h-4" />
        </p>
      </div>
    </div>
  );
}
