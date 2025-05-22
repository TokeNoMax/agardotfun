
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useGame } from "@/context/GameContext";
import GameUI from "@/components/Game/GameUI";

export default function Game() {
  const { currentRoom } = useGame();
  const navigate = useNavigate();
  
  useEffect(() => {
    // If no active room or room is not playing, redirect to lobby
    if (!currentRoom) {
      navigate('/lobby');
    } else if (currentRoom.status !== 'playing') {
      navigate('/lobby');
    }
  }, [currentRoom, navigate]);
  
  return (
    <div className="w-screen h-screen overflow-hidden">
      <GameUI />
    </div>
  );
}
