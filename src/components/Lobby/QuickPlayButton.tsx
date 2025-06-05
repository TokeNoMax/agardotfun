
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useGame } from "@/context/GameContext";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { matchmakingService } from "@/services/player/matchmakingService";
import { Zap, Users } from "lucide-react";

interface QuickPlayButtonProps {
  disabled?: boolean;
  className?: string;
}

export default function QuickPlayButton({ disabled, className }: QuickPlayButtonProps) {
  const { player } = useGame();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isMatching, setIsMatching] = useState(false);

  const handleQuickPlay = async () => {
    if (!player || isMatching) return;

    setIsMatching(true);

    try {
      toast({
        title: "MATCHMAKING_INITIATED",
        description: "Recherche d'une partie en cours...",
      });

      const result = await matchmakingService.findOrCreateRoom(player);
      
      toast({
        title: result.isNewRoom ? "NOUVELLE_SALLE_CRÉÉE" : "SALLE_TROUVÉE",
        description: result.isNewRoom 
          ? "Nouvelle salle créée ! En attente d'autres joueurs..."
          : `Salle trouvée avec ${result.playerCount} joueurs !`,
        duration: 3000,
      });

      // Rediriger vers la partie
      navigate(`/game/${result.roomId}`);
      
    } catch (error) {
      console.error("Error in quick play:", error);
      toast({
        title: "MATCHMAKING_ERROR",
        description: error instanceof Error ? error.message : "Impossible de trouver ou créer une partie",
        variant: "destructive",
      });
    } finally {
      setIsMatching(false);
    }
  };

  return (
    <Button
      onClick={handleQuickPlay}
      disabled={disabled || !player || isMatching}
      className={`bg-gradient-to-r from-cyber-yellow to-cyber-orange hover:from-cyber-orange hover:to-cyber-yellow text-black font-mono font-bold ${className}`}
      size="lg"
    >
      {isMatching ? (
        <>
          <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-black border-t-transparent"></div>
          MATCHING...
        </>
      ) : (
        <>
          <Zap className="mr-2 h-5 w-5" />
          <Users className="mr-2 h-4 w-4" />
          QUICK PLAY
        </>
      )}
    </Button>
  );
}
