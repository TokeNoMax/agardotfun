
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
  
  // Check if we're in local mode
  const isLocalMode = new URLSearchParams(location.search).get('local') === 'true';
  
  // Improved session check function - skipped for local mode
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
      
      // Navigation automatique : permettre l'accès si le jeu est en cours
      if (currentRoom.status !== 'playing') {
        toast({
          title: "Partie non démarrée",
          description: "Cette partie n'est pas encore démarrée. Retour au lobby.",
          variant: "destructive"
        });
        navigate('/lobby');
        return false;
      }
      
      setIsLoading(false);
      setHasVerifiedSession(true);
      return true;
    } catch (error) {
      console.error("Erreur lors de la récupération de la salle:", error);
      toast({
        title: "Erreur de connexion",
        description: "Impossible de rejoindre la partie. Retour au lobby.",
        variant: "destructive"
      });
      navigate('/lobby');
      return false;
    }
  }, [currentRoom, player, navigate, toast, isLocalMode, hasVerifiedSession, refreshCurrentRoom]);
  
  // Effect to check and restore session if necessary - skipped for local mode
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
