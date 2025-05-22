
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useGame } from "@/context/GameContext";
import PlayerCustomization from "@/components/Lobby/PlayerCustomization";
import RoomList from "@/components/Lobby/RoomList";
import { Button } from "@/components/ui/button";
import { Gamepad2Icon } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

export default function Lobby() {
  const { currentRoom, player, createRoom, joinRoom, setPlayerReady, startGame } = useGame();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  useEffect(() => {
    // Uniquement rediriger si la salle existe, a le statut playing, 
    // et que le joueur est dans cette salle
    if (currentRoom && 
        currentRoom.status === 'playing' && 
        player && 
        currentRoom.players.some(p => p.id === player.id)) {
      navigate('/game');
    }
  }, [currentRoom, navigate, player]);

  const handleTestGame = async () => {
    if (!player) {
      toast({
        title: "Erreur",
        description: "Veuillez personnaliser votre blob avant de créer une partie test",
        variant: "destructive"
      });
      return;
    }
    
    try {
      toast({
        title: "Création de la partie test",
        description: "Préparation du mode solo en cours..."
      });
      
      // Créer une salle de test temporaire
      const testRoomName = `Test_${player.name}_${Date.now()}`;
      const roomId = await createRoom(testRoomName, 1);
      
      // Rejoindre la salle
      await joinRoom(roomId);
      
      // Se mettre prêt
      await setPlayerReady(true);
      
      // Démarrer la partie
      await startGame();
      
      // Attendre un court instant pour s'assurer que la base de données est mise à jour
      setTimeout(() => {
        // Naviguer vers la page du jeu
        navigate('/game');
      }, 500);
    } catch (error) {
      console.error("Erreur lors du lancement du mode test:", error);
      toast({
        title: "Erreur",
        description: "Impossible de démarrer le mode test",
        variant: "destructive"
      });
    }
  };
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto py-10">
        <h1 className="text-4xl font-extrabold text-center mb-10 text-indigo-800">
          Blob Battle Royale
        </h1>
        
        <div className="flex flex-col md:flex-row gap-8 items-start justify-center">
          {!player && <PlayerCustomization />}
          <RoomList />
        </div>
        
        {player && (
          <div className="mt-8 flex justify-center">
            <Button 
              onClick={handleTestGame}
              className="bg-amber-500 hover:bg-amber-600 text-white px-6 py-3 text-lg"
            >
              <Gamepad2Icon className="mr-2" />
              Mode Test (solo)
            </Button>
          </div>
        )}
        
        <div className="mt-10 max-w-2xl mx-auto bg-white/80 backdrop-blur rounded-lg p-6 shadow-lg">
          <h2 className="text-xl font-bold mb-4">Comment jouer</h2>
          <ul className="space-y-2 list-disc pl-5 text-gray-700">
            <li>Personnalisez votre blob en choisissant un nom et une couleur</li>
            <li>Créez une nouvelle salle ou rejoignez-en une existante</li>
            <li>Lorsque tous les joueurs sont prêts, cliquez sur "Démarrer la partie"</li>
            <li>Contrôlez votre blob avec la souris</li>
            <li>Mangez des points de nourriture pour grandir</li>
            <li>Évitez les tapis violets qui vous feront rétrécir</li>
            <li>Vous pouvez manger d'autres joueurs qui sont au moins 10% plus petits que vous</li>
            <li>Le dernier blob en vie gagne !</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
