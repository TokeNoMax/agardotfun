
import { useEffect, useState } from "react";
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
  const [isCreatingTestGame, setIsCreatingTestGame] = useState(false);
  
  useEffect(() => {
    // Only redirect to the game if:
    // 1. The room exists
    // 2. The game is in "playing" mode
    // 3. The player exists
    // 4. The player is in the room
    if (currentRoom && 
        currentRoom.status === 'playing' && 
        player && 
        currentRoom.players.some(p => p.id === player.id)) {
      
      // Use a delay to ensure all data is synchronized
      const redirectTimer = setTimeout(() => {
        navigate('/game');
      }, 1000);
      
      return () => clearTimeout(redirectTimer);
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
    
    // Prevent multiple clicks
    if (isCreatingTestGame) return;
    
    try {
      setIsCreatingTestGame(true);
      
      // For online test mode
      const onlineTestMode = async () => {
        toast({
          title: "Création de la partie test",
          description: "Préparation du mode test en cours..."
        });
        
        // Create a test room with a unique name
        const testRoomName = `Test_${player.name}_${Date.now()}`;
        const roomId = await createRoom(testRoomName, 1);
        
        // Join the room
        await joinRoom(roomId);
        
        // Set player ready
        await setPlayerReady(true);
        
        // Start the game after a short delay to ensure synchronization
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const success = await startGame();
        
        if (success) {
          // Wait a longer delay to ensure the database is updated
          setTimeout(() => {
            navigate('/game');
          }, 1500);
        } else {
          setIsCreatingTestGame(false);
          toast({
            title: "Erreur",
            description: "Impossible de démarrer le mode test",
            variant: "destructive"
          });
        }
      };

      // For local test mode
      const localTestMode = () => {
        toast({
          title: "Mode solo local",
          description: "Préparation du mode local..."
        });
        
        // Start local game by navigating with query parameter
        setTimeout(() => {
          navigate('/game?local=true');
          setIsCreatingTestGame(false);
        }, 500);
      };
      
      // Use local mode for stability
      localTestMode();
      
    } catch (error) {
      setIsCreatingTestGame(false);
      console.error("Erreur lors du lancement du mode test:", error);
      toast({
        title: "Erreur",
        description: "Impossible de démarrer le mode test",
        variant: "destructive"
      });
    }
  };
  
  const handleLocalGame = () => {
    if (!player) {
      toast({
        title: "Erreur",
        description: "Veuillez personnaliser votre blob avant de créer une partie locale",
        variant: "destructive"
      });
      return;
    }
    
    navigate('/game?local=true');
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
          <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
            <Button 
              onClick={handleTestGame}
              disabled={isCreatingTestGame}
              className="bg-amber-500 hover:bg-amber-600 text-white px-6 py-3 text-lg"
            >
              {isCreatingTestGame ? (
                <>
                  <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                  Création...
                </>
              ) : (
                <>
                  <Gamepad2Icon className="mr-2" />
                  Mode Test (solo)
                </>
              )}
            </Button>
            
            <Button 
              onClick={handleLocalGame}
              className="bg-green-500 hover:bg-green-600 text-white px-6 py-3 text-lg"
            >
              <Gamepad2Icon className="mr-2" />
              Mode Local (sans réseau)
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
