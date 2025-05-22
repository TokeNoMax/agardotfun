
import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useGame } from "@/context/GameContext";
import GameUI from "@/components/Game/GameUI";
import { useToast } from "@/components/ui/use-toast";

export default function Game() {
  const { currentRoom, player, refreshCurrentRoom } = useGame();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  
  // Fonction de vérification de session mise à jour
  const checkGameSession = useCallback(async () => {
    setIsLoading(true);
    
    try {
      // Si pas de salle active ou le joueur n'est pas défini, rediriger vers le lobby
      if (!currentRoom || !player) {
        toast({
          title: "Session expirée",
          description: "Aucune partie active. Retour au lobby.",
          variant: "destructive"
        });
        navigate('/lobby');
        return;
      } 
      
      // Vérifier que le joueur est dans la salle
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
      
      // Ne redirige vers le lobby que si la salle n'est pas en mode jeu
      if (currentRoom.status !== 'playing') {
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
  }, [currentRoom, player, navigate, toast]);
  
  // Effet pour vérifier et restaurer la session si nécessaire
  useEffect(() => {
    checkGameSession();
  }, [checkGameSession]);
  
  // Rafraîchir périodiquement les informations de la partie, mais moins souvent
  // pour éviter les problèmes de clignotement
  useEffect(() => {
    if (!currentRoom || currentRoom.status !== 'playing' || isLoading) return;
    
    // Rafraîchir toutes les 10 secondes au lieu de 5 pour réduire les risques d'instabilité
    const refreshInterval = setInterval(() => {
      refreshCurrentRoom().catch(error => {
        console.error("Erreur lors du rafraîchissement de la salle:", error);
      });
    }, 10000);
    
    return () => clearInterval(refreshInterval);
  }, [currentRoom, refreshCurrentRoom, isLoading]);
  
  // Afficher un écran de chargement pendant la tentative de reconnexion
  if (isLoading || !currentRoom) {
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
