
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
  
  // Check if we're in local mode
  const isLocalMode = new URLSearchParams(location.search).get('local') === 'true';
  
  // Throttled toast to prevent spam
  const showThrottledToast = useCallback((title: string, description: string, variant?: "default" | "destructive") => {
    const now = Date.now();
    if (now - lastToastTime > 5000) { // 5 second throttle
      setLastToastTime(now);
      toast({ title, description, variant });
    }
  }, [toast, lastToastTime]);
  
  // IMPROVED: More permissive session check to prevent constant resets
  const checkGameSession = useCallback(async () => {
    // Skip validation for local mode
    if (isLocalMode) {
      setIsLoading(false);
      setHasVerifiedSession(true);
      return true;
    }
    
    // If already verified and we have basic requirements, avoid excessive checks
    if (hasVerifiedSession && currentRoom && player) {
      setIsLoading(false);
      return true;
    }
    
    setIsLoading(true);
    
    try {
      await refreshCurrentRoom();
      
      // If no active room or player is not defined, redirect to lobby
      if (!currentRoom || !player) {
        console.log("No active room or player, redirecting to lobby");
        if (!hasVerifiedSession) { // Only show toast on first failure
          showThrottledToast("Session expirée", "Aucune partie active.", "destructive");
        }
        navigate('/lobby');
        return false;
      } 
      
      // Check if players array exists
      if (!currentRoom.players) {
        console.error("Room has no players array");
        showThrottledToast("Erreur de données", "Données de la salle incomplètes.", "destructive");
        navigate('/lobby');
        return false;
      }
      
      // Check if player is in the room
      const isPlayerInRoom = currentRoom.players.some(p => p.id === player.id);
      if (!isPlayerInRoom) {
        showThrottledToast("Session expirée", "Vous n'êtes plus dans cette partie.", "destructive");
        navigate('/lobby');
        return false;
      }
      
      // IMPROVED: Accept both 'waiting' and 'playing' status for active games
      if (currentRoom.status === 'playing' || currentRoom.status === 'waiting') {
        console.log("Game session valid, status:", currentRoom.status);
        setIsLoading(false);
        setHasVerifiedSession(true);
        setRetryCount(0);
        return true;
      } else {
        console.log("Game status not valid for access:", currentRoom.status);
        showThrottledToast("Partie non accessible", "Cette partie n'est pas accessible.", "destructive");
        navigate('/lobby');
        return false;
      }
    } catch (error) {
      console.error("Error checking game session:", error);
      
      // Retry logic with exponential backoff - but less aggressive
      if (retryCount < 2) { // Reduced from 3 to 2 retries
        console.log(`Network error, retry ${retryCount + 1}/2`);
        setRetryCount(prev => prev + 1);
        const retryDelay = 2000 * Math.pow(2, retryCount); // Increased base delay
        setTimeout(() => {
          checkGameSession();
        }, retryDelay);
        return false;
      }
      
      showThrottledToast("Erreur de connexion", "Impossible de rejoindre la partie.", "destructive");
      navigate('/lobby');
      return false;
    }
  }, [currentRoom, player, navigate, isLocalMode, hasVerifiedSession, refreshCurrentRoom, retryCount, showThrottledToast]);
  
  // IMPROVED: Less frequent session checks
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
            <p className="text-sm text-gray-500 mt-2">Tentative {retryCount}/2</p>
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
