
import { useGame } from "@/context/GameContext";
import AvailableRooms from "./AvailableRooms";
import CurrentRoom from "./CurrentRoom";

export default function RoomList() {
  const { currentRoom, player } = useGame();

  if (currentRoom && player) {
    return <CurrentRoom currentRoom={currentRoom} playerId={player.id} />;
  }

  return <AvailableRooms />;
}
