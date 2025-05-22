
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

interface GameOverModalProps {
  open: boolean;
  winner: Player | null;
  onPlayAgain: () => void;
  onBackToLobby: () => void;
}

export default function GameOverModal({
  open,
  winner,
  onPlayAgain,
  onBackToLobby,
}: GameOverModalProps) {
  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-2xl">Game Over!</DialogTitle>
          <DialogDescription className="text-lg">
            {winner ? (
              <>
                <div className="flex flex-col items-center py-6">
                  <div 
                    className={`w-24 h-24 rounded-full mb-4 bg-game-${winner.color}`}
                  >
                    <span className="flex items-center justify-center h-full text-white font-bold text-2xl">
                      #{winner.name.substring(0, 2)}
                    </span>
                  </div>
                  <p className="text-xl font-medium">
                    <span className="font-bold">{winner.name}</span> is the winner!
                  </p>
                </div>
              </>
            ) : (
              <p className="text-center py-6">The game ended in a draw.</p>
            )}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <div className="flex w-full space-x-4">
            <Button 
              variant="outline" 
              onClick={onBackToLobby} 
              className="flex-1"
            >
              Back to Lobby
            </Button>
            <Button 
              onClick={onPlayAgain} 
              className="flex-1"
            >
              Play Again
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
