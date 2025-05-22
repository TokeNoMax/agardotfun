
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useGame } from "@/context/GameContext";
import PlayerCustomization from "@/components/Lobby/PlayerCustomization";
import RoomList from "@/components/Lobby/RoomList";
import { Button } from "@/components/ui/button";
import { Gamepad2Icon, Users, User } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function Lobby() {
  const { player, refreshCurrentRoom } = useGame();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isCreatingTestGame, setIsCreatingTestGame] = useState(false);
  
  // Ajout d'un effet pour rafraîchir les salles au chargement de la page
  useEffect(() => {
    refreshCurrentRoom().catch(error => console.error("Error refreshing rooms:", error));
  }, [refreshCurrentRoom]);
  
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
        
        {!player && (
          <div className="mb-8">
            <PlayerCustomization />
          </div>
        )}
        
        {player && (
          <Tabs defaultValue="multiplayer" className="w-full max-w-5xl mx-auto">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="multiplayer" className="text-lg py-3">
                <Users className="mr-2" /> Mode Multijoueur
              </TabsTrigger>
              <TabsTrigger value="solo" className="text-lg py-3">
                <User className="mr-2" /> Mode Solo
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="multiplayer" className="space-y-8">
              <div className="bg-white/80 backdrop-blur rounded-lg p-6 shadow-lg">
                <h2 className="text-xl font-semibold mb-4">Mode Multijoueur</h2>
                <p className="text-gray-600 mb-4">
                  Créez une salle et invitez d'autres joueurs ou rejoignez une salle existante 
                  pour affronter d'autres adversaires en ligne.
                </p>
                <RoomList />
              </div>
            </TabsContent>
            
            <TabsContent value="solo" className="space-y-8">
              <div className="bg-white/80 backdrop-blur rounded-lg p-6 shadow-lg">
                <h2 className="text-xl font-semibold mb-4">Mode Solo</h2>
                <p className="text-gray-600 mb-4">
                  Jouez une partie rapide en solo, sans avoir à attendre d'autres joueurs.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center mt-6">
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
              </div>
            </TabsContent>
          </Tabs>
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
