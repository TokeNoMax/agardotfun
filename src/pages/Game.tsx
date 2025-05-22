
import { useEffect, useState, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useGame } from "@/context/GameContext";
import GameUI from "@/components/Game/GameUI";
import { useToast } from "@/components/ui/use-toast";

export default function Game() {
  const { currentRoom, player, refreshCurrentRoom } = useGame();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  
  // Check if we're in local mode
  const isLocalMode = new URLSearchParams(location.search).get('local') === 'true';
  
  // Improved session check function - skipped for local mode
  const checkGameSession = useCallback(async () => {
    // Skip validation for local mode
    if (isLocalMode) {
      setIsLoading(false);
      return;
    }
    
    setIsLoading(true);
    
    try {
      // If no active room or player is not defined, redirect to lobby
      if (!currentRoom || !player) {
        toast({
          title: "Session expirée",
          description: "Aucune partie active. Retour au lobby.",
          variant: "destructive"
        });
        navigate('/lobby');
        return;
      } 
      
      // Check if players array exists before trying to use it
      if (!currentRoom.players) {
        console.error("Room has no players array");
        toast({
          title: "Erreur de données",
          description: "Données de la salle incomplètes. Retour au lobby.",
          variant: "destructive"
        });
        navigate('/lobby');
        return;
      }
      
      // Check if player is in the room
      const isPlayerInRoom = currentRoom.players.some(p => p.id === player.id);
      if (!isPlayerInRoom) {
        toast({
          title: "Session expirée",
          description: "Vous n'êtes plus dans cette partie. Retour au lobby.",
          variant: "destructive"
        });
        navigate('/lobby');
        return;
      }
      
      // Only redirect to lobby if room is not in game mode
      // Exception: if it's a solo test mode, we accept even if status is not 'playing'
      const isSoloTestMode = currentRoom.maxPlayers === 1 && currentRoom.players.length === 1;
      if (currentRoom.status !== 'playing' && !isSoloTestMode) {
        toast({
          title: "Partie non démarrée",
          description: "Cette partie n'est pas encore démarrée. Retour au lobby.",
          variant: "destructive"
        });
        navigate('/lobby');
        return;
      }
      
      setIsLoading(false);
    } catch (error) {
      console.error("Erreur lors de la récupération de la salle:", error);
      toast({
        title: "Erreur de connexion",
        description: "Impossible de rejoindre la partie. Retour au lobby.",
        variant: "destructive"
      });
      navigate('/lobby');
    }
  }, [currentRoom, player, navigate, toast, isLocalMode]);
  
  // Effect to check and restore session if necessary - skipped for local mode
  useEffect(() => {
    if (isLocalMode) {
      setIsLoading(false);
    } else {
      checkGameSession();
    }
  }, [checkGameSession, isLocalMode]);
  
  // Show loading screen while connecting
  if (isLoading && !isLocalMode) {
    return (
      <div className="w-screen h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-lg font-medium">Connexion à la partie...</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="w-screen h-screen overflow-hidden">
      <GameUI />
    </div>
  );
}
