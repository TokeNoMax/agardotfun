import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Player } from "@/types/game";
import { Trophy, Zap, Target, Clock } from "lucide-react";
import { useEffect, useState } from "react";

interface GameOverModalProps {
  open: boolean;
  winner: Player | null;
  onPlayAgain: () => void;
  onBackToLobby: () => void;
  gameMode?: 'multiplayer' | 'zone' | 'local';
  gameDuration?: number;
  finalSize?: number;
  eliminationType?: 'absorption' | 'zone' | 'timeout';
}

export default function GameOverModal({
  open,
  winner,
  onPlayAgain,
  onBackToLobby,
  gameMode = 'multiplayer',
  gameDuration = 0,
  finalSize,
  eliminationType = 'absorption',
}: GameOverModalProps) {
  const [showConfetti, setShowConfetti] = useState(false);
  const [countdown, setCountdown] = useState(10);
  
  // Trigger confetti animation when modal opens with a winner
  useEffect(() => {
    if (open && winner) {
      setShowConfetti(true);
      const timer = setTimeout(() => setShowConfetti(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [open, winner]);

  // Countdown timer for automatic return to lobby
  useEffect(() => {
    if (open) {
      setCountdown(10); // Reset countdown when modal opens
      
      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            // Time's up, return to lobby
            onBackToLobby();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [open, onBackToLobby]);

  // Get victory message based on context
  const getVictoryMessage = () => {
    if (!winner || !winner.name) return "Partie terminée";
    
    const messages = {
      multiplayer: [
        `${winner.name} domine totalement !`,
        `${winner.name} écrase la concurrence !`,
        `${winner.name} règne en maître !`,
        `${winner.name} est invincible !`,
        `${winner.name} terrasse ses adversaires !`
      ],
      zone: [
        `${winner.name} survit à l'apocalypse !`,
        `${winner.name} maîtrise la zone !`,
        `${winner.name} défie les éléments !`,
        `${winner.name} est un survivant !`
      ],
      local: [
        `Excellent travail !`,
        `Performance remarquable !`,
        `Tu progresses bien !`,
        `Continue comme ça !`
      ]
    };
    
    const modeMessages = messages[gameMode] || messages.multiplayer;
    return modeMessages[Math.floor(Math.random() * modeMessages.length)];
  };

  // Get elimination description
  const getEliminationDescription = () => {
    switch (eliminationType) {
      case 'absorption':
        return "Un adversaire a été éliminé par absorption";
      case 'zone':
        return "L'adversaire n'a pas survécu à la zone mortelle";
      case 'timeout':
        return "Temps écoulé - victoire par taille";
      default:
        return "Victoire éclatante !";
    }
  };

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

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md relative overflow-hidden">
        {/* Confetti Animation */}
        {showConfetti && winner && (
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-0 left-1/4 w-2 h-2 bg-yellow-400 rounded-full animate-bounce opacity-80"></div>
            <div className="absolute top-0 right-1/4 w-2 h-2 bg-blue-400 rounded-full animate-bounce opacity-80" style={{ animationDelay: '0.2s' }}></div>
            <div className="absolute top-0 left-1/2 w-2 h-2 bg-red-400 rounded-full animate-bounce opacity-80" style={{ animationDelay: '0.4s' }}></div>
            <div className="absolute top-0 left-3/4 w-2 h-2 bg-green-400 rounded-full animate-bounce opacity-80" style={{ animationDelay: '0.6s' }}></div>
            <div className="absolute top-0 right-1/3 w-2 h-2 bg-purple-400 rounded-full animate-bounce opacity-80" style={{ animationDelay: '0.8s' }}></div>
          </div>
        )}
        
        {/* Victory Gradient Background */}
        {winner && (
          <div className="absolute inset-0 bg-gradient-to-br from-yellow-400/10 via-orange-400/10 to-red-400/10 pointer-events-none"></div>
        )}
        
        <DialogHeader>
          <DialogTitle className="text-2xl text-center flex items-center justify-center gap-2">
            {winner && <Trophy className="w-6 h-6 text-yellow-500" />}
            {winner ? "VICTOIRE !" : "Partie Terminée"}
            {winner && <Trophy className="w-6 h-6 text-yellow-500" />}
          </DialogTitle>
          <DialogDescription className="text-lg">
            {winner ? (
              <>
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
                    <p className="text-xl font-bold text-green-600 mb-2 flex items-center justify-center gap-2">
                      🏆 {getVictoryMessage()} 🏆
                    </p>
                    
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
                      {getEliminationDescription()}
                    </p>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-6">
                <p className="text-xl mb-4">🤝</p>
                <p className="text-lg">La partie s'est terminée sans vainqueur</p>
                {gameDuration > 0 && (
                  <p className="text-sm text-muted-foreground mt-2">
                    Durée: {formatDuration(gameDuration)}
                  </p>
                )}
              </div>
            )}
          </DialogDescription>
        </DialogHeader>

        {/* Countdown Display */}
        <div className="text-center py-4 border-t border-border">
          <p className="text-sm text-muted-foreground mb-2">
            Retour automatique au lobby dans :
          </p>
          <div className="text-2xl font-bold text-primary flex items-center justify-center gap-2">
            <Clock className="w-5 h-5" />
            {countdown}s
          </div>
        </div>

        <DialogFooter>
          <div className="flex w-full space-x-4">
            <Button 
              variant="outline" 
              onClick={onBackToLobby} 
              className="flex-1"
            >
              Retour au Lobby
            </Button>
            <Button 
              onClick={onPlayAgain} 
              className="flex-1 bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600"
            >
              Rejouer
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

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
