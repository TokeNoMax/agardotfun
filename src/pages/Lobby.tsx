
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useGame } from "@/context/GameContext";
import PlayerCustomization from "@/components/Lobby/PlayerCustomization";
import RoomList from "@/components/Lobby/RoomList";

export default function Lobby() {
  const { currentRoom } = useGame();
  const navigate = useNavigate();
  
  useEffect(() => {
    if (currentRoom && currentRoom.status === 'playing') {
      navigate('/game');
    }
  }, [currentRoom, navigate]);
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto py-10">
        <h1 className="text-4xl font-extrabold text-center mb-10 text-indigo-800">
          Blob Battle Royale
        </h1>
        
        <div className="flex flex-col md:flex-row gap-8 items-start justify-center">
          <PlayerCustomization />
          <RoomList />
        </div>
        
        <div className="mt-10 max-w-2xl mx-auto bg-white/80 backdrop-blur rounded-lg p-6 shadow-lg">
          <h2 className="text-xl font-bold mb-4">How to Play</h2>
          <ul className="space-y-2 list-disc pl-5 text-gray-700">
            <li>Customize your blob by choosing a name and color</li>
            <li>Create a new game room or join an existing one</li>
            <li>Control your blob with mouse movements</li>
            <li>Eat food pellets to grow larger</li>
            <li>Avoid the purple rugs that will shrink you</li>
            <li>You can eat other players that are at least 10% smaller than you</li>
            <li>Last blob standing wins!</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
