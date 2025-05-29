
import { useEffect, useState, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useGame } from "@/context/GameContext";
import GameUI from "@/components/Game/GameUI";
import { useToast } from "@/hooks/use-toast";

export default function Game() {
  const { currentRoom, player, refreshCurrentRoom } = useGame();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [hasVerifiedSession, setHasVerifiedSession] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  
  // Check if we're in local mode
  const isLocalMode = new URLSearchParams(location.search).get('local') === 'true';
  
  // Improved session check function with retry logic
  const checkGameSession = useCallback(async () => {
    // Skip validation for local mode
    if (isLocalMode) {
      setIsLoading(false);
      setHasVerifiedSession(true);
      return true;
    }
    
    setIsLoading(true);
    
    try {
      // Si nous avons déjà vérifié la session et la salle est en jeu, ne pas revérifier
      if (hasVerifiedSession && currentRoom?.status === 'playing') {
        setIsLoading(false);
        return true;
      }
      
      await refreshCurrentRoom();
      
      // If no active room or player is not defined, redirect to lobby
      if (!currentRoom || !player) {
        console.log("Pas de salle ou joueur actif, redirection vers le lobby");
        toast({
          title: "Session expirée",
          description: "Aucune partie active. Retour au lobby.",
          variant: "destructive"
        });
        navigate('/lobby');
        return false;
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
        return false;
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
        return false;
      }
      
      // Allow access if game is playing OR starting (to handle sync delay)
      if (currentRoom.status !== 'playing') {
        // If status is still 'waiting' but we're retrying, give it more time
        if (retryCount < 3) {
          console.log(`Game not started yet, retry ${retryCount + 1}/3`);
          setRetryCount(prev => prev + 1);
          
          // Wait and retry
          setTimeout(() => {
            checkGameSession();
          }, 1000);
          return false;
        }
        
        console.log("Game status:", currentRoom.status, "after retries");
        toast({
          title: "Partie non accessible",
          description: "Cette partie n'est pas encore démarrée. Retour au lobby.",
          variant: "destructive"
        });
        navigate('/lobby');
        return false;
      }
      
      setIsLoading(false);
      setHasVerifiedSession(true);
      setRetryCount(0); // Reset retry count on success
      return true;
    } catch (error) {
      console.error("Erreur lors de la récupération de la salle:", error);
      
      // Retry on error up to 3 times
      if (retryCount < 3) {
        console.log(`Network error, retry ${retryCount + 1}/3`);
        setRetryCount(prev => prev + 1);
        setTimeout(() => {
          checkGameSession();
        }, 1500);
        return false;
      }
      
      toast({
        title: "Erreur de connexion",
        description: "Impossible de rejoindre la partie. Retour au lobby.",
        variant: "destructive"
      });
      navigate('/lobby');
      return false;
    }
  }, [currentRoom, player, navigate, toast, isLocalMode, hasVerifiedSession, refreshCurrentRoom, retryCount]);
  
  // Effect to check and restore session if necessary
  useEffect(() => {
    if (!hasVerifiedSession) {
      checkGameSession();
    }
  }, [checkGameSession, hasVerifiedSession]);
  
  // Show loading screen while connecting
  if (isLoading && !isLocalMode) {
    return (
      <div className="w-screen h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-lg font-medium">Connexion à la partie...</p>
          {retryCount > 0 && (
            <p className="text-sm text-gray-500 mt-2">Tentative {retryCount}/3</p>
          )}
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
