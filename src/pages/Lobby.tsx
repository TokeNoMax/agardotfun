import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useGame } from "@/context/GameContext";
import PlayerCustomization from "@/components/Lobby/PlayerCustomization";
import RoomList from "@/components/Lobby/RoomList";
import { Button } from "@/components/ui/button";
import { Gamepad2Icon, Users, User, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle, 
  SheetTrigger 
} from "@/components/ui/sheet";

export default function Lobby() {
  const { player, refreshCurrentRoom, leaveRoom, currentRoom } = useGame();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isCreatingTestGame, setIsCreatingTestGame] = useState(false);
  const [hasInitialized, setHasInitialized] = useState(false);
  
  // Improved initialization with better session cleanup
  useEffect(() => {
    const initializeLobby = async () => {
      if (hasInitialized) return;
      
      console.log("Initializing lobby...");
      setHasInitialized(true);
      
      try {
        // Check for any finished games in localStorage
        const gameState = localStorage.getItem('blob-battle-game-state');
        if (gameState) {
          const parsedState = JSON.parse(gameState);
          if (parsedState.status === 'finished') {
            console.log("Found finished game, cleaning up...");
            localStorage.removeItem('blob-battle-game-state');
            
            // Only leave room if we're actually in one
            if (currentRoom && currentRoom.status === 'finished') {
              await leaveRoom();
            }
          }
        }
        
        // Force refresh current room to sync with server
        await refreshCurrentRoom();
        console.log("Lobby initialization complete");
        
      } catch (error) {
        console.error("Error during lobby initialization:", error);
        // If there's an error, clear potentially corrupted state
        localStorage.removeItem('blob-battle-current-room');
        localStorage.removeItem('blob-battle-game-state');
      }
    };
    
    initializeLobby();
  }, [hasInitialized, currentRoom, leaveRoom, refreshCurrentRoom]);
  
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
      
      // For local test mode - simplify by directly navigating to game with local param
      toast({
        title: "Mode solo local",
        description: "Préparation du mode local..."
      });
      
      // Start local game by navigating with query parameter
      setTimeout(() => {
        navigate('/game?local=true');
        setIsCreatingTestGame(false);
      }, 500);
      
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
        {/* Header with logo and back button */}
        <div className="flex justify-between items-center mb-8">
          <Button 
            variant="outline" 
            size="icon" 
            onClick={() => navigate("/")}
            className="rounded-full"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center">
            <h1 className="text-3xl font-extrabold text-indigo-800">
              agar<span className="text-indigo-500">.fun</span>
            </h1>
          </div>
          
          {/* Profile button / personalization button */}
          <Sheet>
            <SheetTrigger asChild>
              <Button 
                variant={player ? "outline" : "default"}
                className={player ? "gap-2" : ""}
              >
                {player ? (
                  <>
                    <div 
                      className="w-6 h-6 rounded-full"
                      style={{ backgroundColor: `#${getColorHex(player.color)}` }}
                    ></div>
                    <span>{player.name}</span>
                  </>
                ) : (
                  "Personnaliser"
                )}
              </Button>
            </SheetTrigger>
            <SheetContent>
              <SheetHeader className="mb-5">
                <SheetTitle>Personnalisation</SheetTitle>
              </SheetHeader>
              <PlayerCustomization />
            </SheetContent>
          </Sheet>
        </div>
        
        <div className="flex flex-col items-center mb-10">
          <h2 className="text-2xl font-bold text-center mb-3">Lobby de jeu</h2>
          <p className="text-gray-600 max-w-lg text-center">
            Rejoignez ou créez une partie pour commencer à jouer. Assurez-vous de personnaliser votre blob avant de rejoindre une partie.
          </p>
        </div>
        
        {!player ? (
          <div className="max-w-md mx-auto bg-white p-6 rounded-lg shadow-lg mb-8 text-center">
            <h3 className="text-xl font-semibold mb-4">Personnalisez votre blob</h3>
            <p className="text-gray-600 mb-4">
              Vous devez créer un blob personnalisé pour rejoindre ou créer des parties.
            </p>
            <Sheet>
              <SheetTrigger asChild>
                <Button className="w-full">Personnaliser mon blob</Button>
              </SheetTrigger>
              <SheetContent>
                <SheetHeader className="mb-5">
                  <SheetTitle>Personnalisation</SheetTitle>
                </SheetHeader>
                <PlayerCustomization />
              </SheetContent>
            </Sheet>
          </div>
        ) : (
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

// Helper function to get color hex
function getColorHex(color: string): string {
  const colorMap: Record<string, string> = {
    blue: '3498db',
    red: 'e74c3c',
    green: '2ecc71',
    yellow: 'f1c40f',
    purple: '9b59b6',
    orange: 'e67e22',
    cyan: '1abc9c',
    pink: 'fd79a8'
  };
  return colorMap[color] || '3498db';
}
