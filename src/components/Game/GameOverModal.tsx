
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
import { Trophy } from "lucide-react";
import { useEffect, useState } from "react";
import ConfettiEffect from "./ConfettiEffect";
import CountdownTimer from "./CountdownTimer";
import VictoryDisplay from "./VictoryDisplay";

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
  
  // Trigger confetti animation when modal opens with a winner
  useEffect(() => {
    if (open && winner) {
      setShowConfetti(true);
      const timer = setTimeout(() => setShowConfetti(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [open, winner]);

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md relative overflow-hidden">
        <ConfettiEffect show={showConfetti && !!winner} />
        
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
            <VictoryDisplay
              winner={winner}
              gameMode={gameMode}
              gameDuration={gameDuration}
              finalSize={finalSize}
              eliminationType={eliminationType}
              showConfetti={showConfetti}
            />
          </DialogDescription>
        </DialogHeader>

        <CountdownTimer isActive={open} onComplete={onBackToLobby} />

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
