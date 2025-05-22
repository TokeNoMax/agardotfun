
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useGame } from "@/context/GameContext";
import Canvas from "./Canvas";
import GameOverModal from "./GameOverModal";
import { Player } from "@/types/game";
import { useNavigate } from "react-router-dom";

export default function GameUI() {
  const { currentRoom, leaveRoom, player } = useGame();
  const [isGameOver, setIsGameOver] = useState(false);
  const [winner, setWinner] = useState<Player | null>(null);
  const [alivePlayers, setAlivePlayers] = useState<number>(0);
  const navigate = useNavigate();
  
  // Calculate alive players only when currentRoom changes
  useEffect(() => {
    if (currentRoom) {
      const alive = currentRoom.players.filter(p => p.isAlive).length;
      setAlivePlayers(alive || currentRoom.players.length);
    }
  }, [currentRoom]);

  // Vérification que le joueur actuel existe et est dans la salle - exécutée une seule fois
  useEffect(() => {
    if (!currentRoom || !player || !currentRoom.players.some(p => p.id === player.id)) {
      // On met un petit délai pour éviter les redirections trop rapides en cas de latence réseau
      const timer = setTimeout(() => {
        navigate('/lobby');
      }, 500);
      
      return () => clearTimeout(timer);
    }
  }, [currentRoom, player, navigate]);

  const handleGameOver = (winner: Player | null) => {
    // In solo test mode, don't end the game automatically
    const isSoloMode = currentRoom?.maxPlayers === 1 && currentRoom.players.length === 1;
    
    if (isSoloMode) {
      console.log("Solo mode: Game would normally end here, but we're continuing for testing");
      return;
    }
    
    setWinner(winner);
    setIsGameOver(true);
  };
  
  // Add force game over functionality for solo mode
  const handleForceGameOver = () => {
    setWinner(player);
    setIsGameOver(true);
  };
  
  const handlePlayAgain = async () => {
    await leaveRoom();
    setIsGameOver(false);
    navigate('/lobby');
  };
  
  const handleBackToLobby = async () => {
    await leaveRoom();
    setIsGameOver(false);
    navigate('/lobby');
  };
  
  // Protection against null currentRoom
  if (!currentRoom) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="text-center">
          <p className="text-lg font-medium mb-4">Problème de connexion à la salle de jeu</p>
          <Button onClick={() => navigate('/lobby')}>
            Retour au lobby
          </Button>
        </div>
      </div>
    );
  }
  
  // Check if this is a solo test mode
  const isSoloTestMode = currentRoom.maxPlayers === 1 && currentRoom.players.length === 1;
  
  return (
    <div className="w-full h-full relative">
      {/* Game status */}
      <div className="absolute top-4 left-4 bg-white/80 backdrop-blur-sm p-3 rounded-md shadow-md z-10">
        <div className="text-sm font-medium">Joueurs en vie: {alivePlayers}</div>
        <div className="text-sm font-medium">Salle: {currentRoom.name}</div>
        {player && (
          <div className="text-sm font-medium">Vous: {player.name}</div>
        )}
        {isSoloTestMode && (
          <div className="text-sm font-medium text-green-600">Mode Test Solo</div>
        )}
      </div>
      
      {/* Control panel for solo test mode */}
      {isSoloTestMode && (
        <div className="absolute top-4 right-4 z-10 flex gap-2">
          <Button 
            variant="secondary" 
            size="sm"
            onClick={handleForceGameOver}
          >
            Terminer Test
          </Button>
          <Button 
            variant="destructive" 
            size="sm"
            onClick={handleBackToLobby}
          >
            Quitter
          </Button>
        </div>
      )}
      
      {/* Regular exit button for multiplayer */}
      {!isSoloTestMode && (
        <div className="absolute top-4 right-4 z-10">
          <Button 
            variant="destructive" 
            size="sm"
            onClick={handleBackToLobby}
          >
            Quitter
          </Button>
        </div>
      )}
      
      {/* Game canvas */}
      <div className="w-full h-full">
        <Canvas onGameOver={handleGameOver} />
      </div>
      
      {/* Game over modal */}
      <GameOverModal
        open={isGameOver}
        winner={winner}
        onPlayAgain={handlePlayAgain}
        onBackToLobby={handleBackToLobby}
      />
    </div>
  );
}
