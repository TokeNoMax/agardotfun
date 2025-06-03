
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
          <DialogTitle className="text-2xl text-center">Game Over!</DialogTitle>
          <DialogDescription className="text-lg">
            {winner ? (
              <>
                <div className="flex flex-col items-center py-6">
                  <div 
                    className={`w-24 h-24 rounded-full mb-4 bg-game-${winner.color} flex items-center justify-center`}
                    style={{ backgroundColor: `#${getColorHex(winner.color)}` }}
                  >
                    {winner.nftImageUrl ? (
                      <img 
                        src={winner.nftImageUrl} 
                        alt={winner.name}
                        className="w-full h-full rounded-full object-cover"
                      />
                    ) : (
                      <span className="text-white font-bold text-2xl">
                        {winner.name.substring(0, 2).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="text-center">
                    <p className="text-xl font-bold text-green-600 mb-2">
                      🏆 VICTOIRE! 🏆
                    </p>
                    <p className="text-lg font-medium">
                      <span className="font-bold text-primary">{winner.name}</span> domine la bataille !
                    </p>
                    <p className="text-sm text-muted-foreground mt-2">
                      Un adversaire a été éliminé par absorption
                    </p>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-6">
                <p className="text-xl mb-4">🤝</p>
                <p className="text-lg">La partie s'est terminée sans vainqueur</p>
              </div>
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
              Retour au Lobby
            </Button>
            <Button 
              onClick={onPlayAgain} 
              className="flex-1"
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
