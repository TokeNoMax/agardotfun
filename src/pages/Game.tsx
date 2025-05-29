
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
  const [lastToastTime, setLastToastTime] = useState(0);
  const [navigationTime, setNavigationTime] = useState(Date.now());
  
  // Check if we're in local mode
  const isLocalMode = new URLSearchParams(location.search).get('local') === 'true';
  
  // Throttled toast to prevent spam
  const showThrottledToast = useCallback((title: string, description: string, variant?: "default" | "destructive") => {
    const now = Date.now();
    if (now - lastToastTime > 5000) { // 5 second throttle pour éviter le spam
      setLastToastTime(now);
      toast({ title, description, variant });
    }
  }, [toast, lastToastTime]);
  
  // Session check améliorée pour accepter le statut 'waiting' pendant la transition
  const checkGameSession = useCallback(async () => {
    // Skip validation for local mode
    if (isLocalMode) {
      setIsLoading(false);
      setHasVerifiedSession(true);
      return true;
    }
    
    setIsLoading(true);
    
    try {
      // Si déjà vérifié et statut valide, éviter les vérifications répétées
      if (hasVerifiedSession && currentRoom?.status === 'playing') {
        setIsLoading(false);
        return true;
      }
      
      await refreshCurrentRoom();
      
      // If no active room or player is not defined, redirect to lobby
      if (!currentRoom || !player) {
        console.log("No active room or player, redirecting to lobby");
        showThrottledToast("Session expirée", "Aucune partie active. Retour au lobby.", "destructive");
        navigate('/lobby');
        return false;
      } 
      
      // Check if players array exists
      if (!currentRoom.players) {
        console.error("Room has no players array");
        showThrottledToast("Erreur de données", "Données de la salle incomplètes. Retour au lobby.", "destructive");
        navigate('/lobby');
        return false;
      }
      
      // Check if player is in the room
      const isPlayerInRoom = currentRoom.players.some(p => p.id === player.id);
      if (!isPlayerInRoom) {
        showThrottledToast("Session expirée", "Vous n'êtes plus dans cette partie. Retour au lobby.", "destructive");
        navigate('/lobby');
        return false;
      }
      
      // Logique améliorée pour accepter 'waiting' pendant la transition
      const timeSinceNavigation = Date.now() - navigationTime;
      
      if (currentRoom.status === 'playing') {
        console.log("Game is playing, access granted");
        setIsLoading(false);
        setHasVerifiedSession(true);
        setRetryCount(0);
        return true;
      } else if (currentRoom.status === 'waiting' && timeSinceNavigation < 10000) {
        // Accepter 'waiting' pendant les 10 premières secondes après navigation
        console.log("Game status is waiting but within transition period, allowing access");
        setIsLoading(false);
        setHasVerifiedSession(true);
        setRetryCount(0);
        return true;
      } else if (currentRoom.status === 'waiting') {
        // Retry logic pour waiting status après la période de grâce
        if (retryCount < 3) {
          console.log(`Game not started yet, retry ${retryCount + 1}/3`);
          setRetryCount(prev => prev + 1);
          
          setTimeout(() => {
            checkGameSession();
          }, 1500);
          return false;
        }
        
        console.log("Game status:", currentRoom.status, "after max retries");
        showThrottledToast("Attente trop longue", "La partie met du temps à démarrer. Retour au lobby.", "destructive");
        navigate('/lobby');
        return false;
      } else {
        console.log("Game status not valid for access:", currentRoom.status);
        showThrottledToast("Partie non accessible", "Cette partie n'est pas accessible. Retour au lobby.", "destructive");
        navigate('/lobby');
        return false;
      }
    } catch (error) {
      console.error("Error checking game session:", error);
      
      // Retry logic with exponential backoff
      if (retryCount < 3) {
        console.log(`Network error, retry ${retryCount + 1}/3`);
        setRetryCount(prev => prev + 1);
        const retryDelay = 1000 * Math.pow(2, retryCount);
        setTimeout(() => {
          checkGameSession();
        }, retryDelay);
        return false;
      }
      
      showThrottledToast("Erreur de connexion", "Impossible de rejoindre la partie. Retour au lobby.", "destructive");
      navigate('/lobby');
      return false;
    }
  }, [currentRoom, player, navigate, isLocalMode, hasVerifiedSession, refreshCurrentRoom, retryCount, showThrottledToast, navigationTime]);
  
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
