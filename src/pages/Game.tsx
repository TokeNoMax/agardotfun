import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useWallet } from "@solana/wallet-adapter-react";
import { useGame } from "@/context/GameContext";
import { useToast } from "@/hooks/use-toast";
import Canvas from "@/components/Game/Canvas";
import GameUI from "@/components/Game/GameUI";
import Leaderboard from "@/components/Game/Leaderboard";
import GameOverModal from "@/components/Game/GameOverModal";
import TouchControlArea from "@/components/Game/TouchControlArea";
import ZoneCounter from "@/components/Game/ZoneCounter";
import { useAuthGuard } from "@/hooks/useAuthGuard";

export default function Game() {
  const { isAuthenticated, isLoading: authLoading, user } = useAuthGuard();
  
  const { currentRoom, player, refreshCurrentRoom } = useGame();
  const navigate = useNavigate();
  const location = useLocation();
  const { roomId } = useParams();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [hasVerifiedSession, setHasVerifiedSession] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [lastToastTime, setLastToastTime] = useState(0);
  const [gameLoading, setGameLoading] = useState(true);
  
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
  
  // IMPROVED: Enhanced session check with room ID validation
  const checkGameSession = useCallback(async () => {
    // Skip validation for local mode
    if (isLocalMode) {
      setIsLoading(false);
      setHasVerifiedSession(true);
      return true;
    }
    
    // FIXED: Validate room ID from URL
    if (roomId && (!currentRoom || currentRoom.id !== roomId)) {
      console.log("Room ID mismatch or no current room, refreshing...");
      try {
        await refreshCurrentRoom();
      } catch (error) {
        console.error("Error refreshing room:", error);
        showThrottledToast("Erreur de synchronisation", "Impossible de synchroniser avec la partie.", "destructive");
        navigate('/lobby');
        return false;
      }
    }
    
    // If already verified and we have basic requirements, avoid excessive checks
    if (hasVerifiedSession && currentRoom && player && (!roomId || currentRoom.id === roomId)) {
      setIsLoading(false);
      return true;
    }
    
    setIsLoading(true);
    
    try {
      // If no active room or player is not defined, redirect to lobby
      if (!currentRoom || !player) {
        console.log("No active room or player, redirecting to lobby");
        if (!hasVerifiedSession) { // Only show toast on first failure
          showThrottledToast("Session expirée", "Aucune partie active.", "destructive");
        }
        navigate('/lobby');
        return false;
      } 
      
      // FIXED: Validate room ID matches URL parameter
      if (roomId && currentRoom.id !== roomId) {
        console.log("Room ID mismatch:", { urlRoomId: roomId, currentRoomId: currentRoom.id });
        showThrottledToast("Partie incorrecte", "Vous n'êtes pas dans la bonne partie.", "destructive");
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
        console.log("Game session valid, status:", currentRoom.status, "Room ID:", currentRoom.id);
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
  }, [currentRoom, player, navigate, isLocalMode, hasVerifiedSession, refreshCurrentRoom, retryCount, showThrottledToast, roomId]);
  
  // IMPROVED: Less frequent session checks
  useEffect(() => {
    if (!hasVerifiedSession) {
      checkGameSession();
    }
  }, [checkGameSession, hasVerifiedSession]);
  
  // Show loading screen while connecting
  if (gameLoading && !isLocalMode) {
    return (
      <div className="w-screen h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-lg font-medium">Connexion à la partie...</p>
          {retryCount > 0 && (
            <p className="text-sm text-gray-500 mt-2">Tentative {retryCount}/2</p>
          )}
          {roomId && (
            <p className="text-sm text-gray-400 mt-1">Room: {roomId}</p>
          )}
        </div>
      </div>
    );
  }
  
  if (authLoading) {
    return (
      <div className="w-screen h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-lg font-medium">Authentification...</p>
        </div>
      </div>
    );
  }
  
  if (!isAuthenticated) {
    return null; // AuthGuard will redirect
  }
  
  return (
    <div className="w-screen h-screen overflow-hidden">
      <GameUI roomId={roomId} />
    </div>
  );
}
