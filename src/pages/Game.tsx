
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useGame } from "@/context/GameContext";
import GameUI from "@/components/Game/GameUI";
import { useToast } from "@/components/ui/use-toast";

export default function Game() {
  const { currentRoom, refreshCurrentRoom } = useGame();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  // Effet pour vérifier et restaurer la session si nécessaire
  useEffect(() => {
    // Si pas de salle active, tenter une reconnexion
    if (!currentRoom) {
      refreshCurrentRoom().then(() => {
        // Si toujours pas de salle active après la tentative, rediriger vers le lobby
        if (!currentRoom) {
          toast({
            title: "Session expirée",
            description: "Votre session de jeu a expiré. Retour au lobby.",
            variant: "destructive"
          });
          navigate('/lobby');
        }
      });
    } else if (currentRoom.status !== 'playing') {
      navigate('/lobby');
    }
  }, [currentRoom, navigate]);
  
  // Rafraîchir périodiquement les informations de la partie
  useEffect(() => {
    // Rafraîchir toutes les 3 secondes pour maintenir la synchronisation
    const refreshInterval = setInterval(() => {
      refreshCurrentRoom();
    }, 3000);
    
    return () => clearInterval(refreshInterval);
  }, []);
  
  // Afficher un écran de chargement pendant la tentative de reconnexion
  if (!currentRoom) {
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
