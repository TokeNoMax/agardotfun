
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useGame } from "@/context/GameContext";
import Canvas from "./Canvas";
import GameOverModal from "./GameOverModal";
import { Player } from "@/types/game";
import { useNavigate } from "react-router-dom";

export default function GameUI() {
  const { currentRoom, leaveRoom } = useGame();
  const [isGameOver, setIsGameOver] = useState(false);
  const [winner, setWinner] = useState<Player | null>(null);
  const [alivePlayers, setAlivePlayers] = useState<number>(0);
  const navigate = useNavigate();
  
  useEffect(() => {
    if (currentRoom) {
      const alive = currentRoom.players.filter(p => p.isAlive).length;
      setAlivePlayers(alive || currentRoom.players.length);
    }
  }, [currentRoom]);

  const handleGameOver = (winner: Player | null) => {
    setWinner(winner);
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
  
  if (!currentRoom) {
    return null;
  }
  
  return (
    <div className="w-full h-full relative">
      {/* Game status */}
      <div className="absolute top-4 left-4 bg-white/80 backdrop-blur-sm p-3 rounded-md shadow-md z-10">
        <div className="text-sm font-medium">Joueurs en vie: {alivePlayers}</div>
        <div className="text-sm font-medium">Salle: {currentRoom.name}</div>
      </div>
      
      {/* Leave button */}
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
