
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import PlayerCustomization from "@/components/Lobby/PlayerCustomization";
import { useGame } from "@/context/GameContext";

export default function Index() {
  const navigate = useNavigate();
  const { player } = useGame();
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex flex-col items-center justify-center p-4">
      <h1 className="text-5xl font-extrabold text-center mb-8 text-indigo-800">
        Blob Battle Royale
      </h1>
      
      <div className="w-full max-w-4xl flex flex-col md:flex-row gap-8 items-center justify-center">
        <PlayerCustomization />
        
        <div className="w-full max-w-md bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-2xl font-bold text-center mb-6">Prêt à jouer ?</h2>
          <Button 
            onClick={() => navigate("/lobby")} 
            className="w-full py-6 text-lg"
            disabled={!player}
          >
            Entrer dans le lobby
          </Button>
          
          {!player && (
            <p className="text-center mt-4 text-gray-500">
              Veuillez personnaliser votre blob avant de jouer
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
