
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
  const [localMode, setLocalMode] = useState<boolean>(false);
  const [localPlayer, setLocalPlayer] = useState<Player | null>(null);
  const navigate = useNavigate();
  
  // Check if we're in local mode based on URL parameters
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const isLocalMode = urlParams.get('local') === 'true';
    
    if (isLocalMode) {
      // Create a local player if in local mode
      setLocalMode(true);
      setLocalPlayer({
        id: "local-player",
        name: player?.name || "LocalPlayer",
        color: player?.color || "blue",
        size: 15,
        x: 750,
        y: 750,
        isAlive: true
      });
      
      setAlivePlayers(1);
    } else if (currentRoom) {
      // Normal online mode - use currentRoom
      const alive = currentRoom.players.filter(p => p.isAlive).length;
      setAlivePlayers(alive || currentRoom.players.length);
    }
  }, [currentRoom, player]);

  // Redirect if not in local mode and no valid session
  useEffect(() => {
    if (!localMode && (!currentRoom || !player || !currentRoom.players.some(p => p.id === player.id))) {
      const timer = setTimeout(() => {
        navigate('/lobby');
      }, 500);
      
      return () => clearTimeout(timer);
    }
  }, [currentRoom, player, navigate, localMode]);

  const handleGameOver = (winner: Player | null) => {
    setWinner(winner);
    setIsGameOver(true);
  };
  
  const handlePlayAgain = async () => {
    if (localMode) {
      // For local mode, just reset the game
      window.location.reload();
    } else {
      // Online mode - leave room and go back to lobby
      await leaveRoom();
      setIsGameOver(false);
      navigate('/lobby');
    }
  };
  
  const handleBackToLobby = async () => {
    if (localMode) {
      // Just navigate back without API calls
      navigate('/lobby');
    } else {
      // Online mode - leave room and go back to lobby
      await leaveRoom();
      setIsGameOver(false);
      navigate('/lobby');
    }
  };
  
  // Show loading if not in local mode and no room
  if (!localMode && !currentRoom) {
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
  
  return (
    <div className="w-full h-full relative">
      {/* Game status */}
      <div className="absolute top-4 left-4 bg-white/80 backdrop-blur-sm p-3 rounded-md shadow-md z-10">
        <div className="text-sm font-medium">
          {localMode ? "Mode Solo Local" : `Joueurs en vie: ${alivePlayers}`}
        </div>
        {!localMode && currentRoom && (
          <div className="text-sm font-medium">Salle: {currentRoom.name}</div>
        )}
        <div className="text-sm font-medium">
          Vous: {localMode ? localPlayer?.name : player?.name}
        </div>
      </div>
      
      {/* Exit button */}
      <div className="absolute top-4 right-4 z-10">
        <Button 
          variant="destructive" 
          size="sm"
          onClick={handleBackToLobby}
        >
          Quitter
        </Button>
      </div>
      
      {/* Game canvas */}
      <div className="w-full h-full">
        <Canvas 
          onGameOver={handleGameOver} 
          isLocalMode={localMode}
          localPlayer={localPlayer}
        />
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
