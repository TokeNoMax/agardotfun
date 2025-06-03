
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw, LogOut } from "lucide-react";
import { GameRoom } from "@/types/game";
import { useGame } from "@/context/GameContext";
import { useToast } from "@/hooks/use-toast";

interface GhostRoomDetectorProps {
  currentRoom: GameRoom;
  playerId: string;
}

export default function GhostRoomDetector({ currentRoom, playerId }: GhostRoomDetectorProps) {
  const [isGhostRoom, setIsGhostRoom] = useState(false);
  const [forceQuitting, setForceQuitting] = useState(false);
  const { leaveRoom, refreshCurrentRoom } = useGame();
  const { toast } = useToast();

  // Detect ghost room conditions
  useEffect(() => {
    const detectGhostRoom = () => {
      if (!currentRoom.players) return false;

      const activePlayers = currentRoom.players.filter(p => p.id === playerId);
      const isAloneInPlayingGame = currentRoom.status === 'playing' && 
                                   currentRoom.players.length === 1 && 
                                   activePlayers.length === 1;

      const isStuckInGame = currentRoom.status === 'playing' && 
                           currentRoom.players.length <= 1;

      return isAloneInPlayingGame || isStuckInGame;
    };

    const ghostDetected = detectGhostRoom();
    setIsGhostRoom(ghostDetected);

    if (ghostDetected) {
      console.log("Ghost room detected:", {
        roomId: currentRoom.id,
        status: currentRoom.status,
        playerCount: currentRoom.players?.length,
        playerId
      });
    }
  }, [currentRoom, playerId]);

  const handleForceQuit = async () => {
    setForceQuitting(true);
    
    try {
      toast({
        title: "EMERGENCY_CLEANUP",
        description: "Nettoyage forcé de la salle fantôme en cours...",
      });

      await leaveRoom();
      
      toast({
        title: "CLEANUP_SUCCESS",
        description: "Vous avez quitté la salle fantôme avec succès !",
      });
    } catch (error) {
      console.error("Error force quitting:", error);
      toast({
        title: "CLEANUP_ERROR",
        description: "Impossible de quitter la salle. Essayez de rafraîchir.",
        variant: "destructive"
      });
    } finally {
      setForceQuitting(false);
    }
  };

  const handleForceRefresh = async () => {
    try {
      toast({
        title: "SYNC_REFRESH",
        description: "Synchronisation forcée en cours...",
      });

      await refreshCurrentRoom();
      
      toast({
        title: "SYNC_SUCCESS",
        description: "Données synchronisées !",
      });
    } catch (error) {
      console.error("Error force refreshing:", error);
      toast({
        title: "SYNC_ERROR",
        description: "Erreur lors de la synchronisation.",
        variant: "destructive"
      });
    }
  };

  if (!isGhostRoom) return null;

  return (
    <div className="mb-4 relative">
      <div className="absolute inset-0 bg-gradient-to-r from-red-500/20 to-orange-500/20 rounded-lg blur-xl"></div>
      <div className="relative bg-black/90 backdrop-blur-sm border-2 border-red-500/50 rounded-lg p-4 shadow-[0_0_20px_rgba(255,0,0,0.3)]">
        <div className="flex items-center gap-3 mb-3">
          <AlertTriangle className="h-5 w-5 text-red-400 animate-pulse" />
          <h4 className="text-red-400 font-mono font-bold">GHOST_ROOM_DETECTED</h4>
        </div>
        
        <p className="text-gray-300 text-sm mb-4 font-mono">
          Cette salle est en mode fantôme (partie en cours avec 1 seul joueur). 
          Les autres joueurs ont probablement quitté sans synchronisation.
        </p>
        
        <div className="flex gap-2">
          <Button
            onClick={handleForceRefresh}
            variant="outline"
            size="sm"
            className="text-yellow-400 border-yellow-400/50 hover:bg-yellow-400/10 font-mono"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            FORCE_SYNC
          </Button>
          
          <Button
            onClick={handleForceQuit}
            disabled={forceQuitting}
            size="sm"
            className="bg-red-500/20 text-red-400 border border-red-500/50 hover:bg-red-500/30 font-mono"
          >
            <LogOut className="h-4 w-4 mr-2" />
            {forceQuitting ? "QUITTING..." : "FORCE_QUIT"}
          </Button>
        </div>
      </div>
    </div>
  );
}
