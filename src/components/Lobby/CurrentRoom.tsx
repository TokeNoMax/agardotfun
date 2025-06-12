
import { Button } from "@/components/ui/button";
import { useGame } from "@/context/GameContext";
import { GameRoom } from "@/types/game";
import { Zap, Users, Play, LogOut } from "lucide-react";
import GhostRoomDetector from "./GhostRoomDetector";
import GameStartCountdown from "./GameStartCountdown";

interface CurrentRoomProps {
  currentRoom: GameRoom;
  countdown: number | null;
  gameStarting: boolean;
  handleToggleReady: () => Promise<void>;
  handleStartGame: () => Promise<void>;
  handleLeaveRoom: () => Promise<void>;
  handleJoinGame: () => void;
  handleJoinRoom: (roomId: string) => Promise<void>;
  isCurrentPlayerReady: () => boolean;
  isCurrentPlayerInRoom: () => boolean;
}

export default function CurrentRoom({
  currentRoom,
  countdown,
  gameStarting,
  handleToggleReady,
  handleStartGame,
  handleLeaveRoom,
  handleJoinGame,
  handleJoinRoom,
  isCurrentPlayerReady,
  isCurrentPlayerInRoom
}: CurrentRoomProps) {
  const { player } = useGame();
  
  // FIXED: Improved game mode display
  const getGameModeDisplay = (gameMode?: string) => {
    console.log("CurrentRoom - Game mode:", gameMode);
    
    const normalizedMode = gameMode?.toLowerCase().trim();
    
    switch (normalizedMode) {
      case 'battle_royale':
        return { text: 'BATTLE_ROYALE', color: 'text-cyber-purple' };
      case 'classic':
        return { text: 'CLASSIC', color: 'text-cyber-green' };
      default:
        console.warn("CurrentRoom - Unknown game mode:", gameMode);
        return { text: 'CLASSIC', color: 'text-cyber-green' };
    }
  };
  
  const modeInfo = getGameModeDisplay(currentRoom.gameMode);
  
  return (
    <>
      {/* Game Start Countdown Overlay */}
      <GameStartCountdown countdown={countdown || 0} gameStarting={gameStarting} />
      
      <div className="relative mb-6">
        {/* Ghost Room Detector */}
        {player && currentRoom && (
          <GhostRoomDetector 
            currentRoom={currentRoom} 
            playerId={player.id} 
          />
        )}
        
        <div className="absolute inset-0 bg-gradient-to-r from-cyber-cyan/20 to-cyber-green/20 rounded-lg blur-xl"></div>
        <div className="relative bg-black/80 backdrop-blur-sm border-2 border-cyber-cyan/50 rounded-lg p-6 shadow-[0_0_20px_rgba(0,255,255,0.2)]">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h3 className="text-2xl font-bold text-cyber-cyan font-mono mb-2">{currentRoom.name}</h3>
              <p className="text-gray-300 font-mono">
                <Users className="inline h-4 w-4 mr-1" />
                {currentRoom.players && currentRoom.players.length}/{currentRoom.maxPlayers} nodes • 
                <span className={`ml-2 ${
                  currentRoom.status === 'waiting' ? 'text-cyber-yellow' : 
                  currentRoom.status === 'playing' ? 'text-cyber-green' : 'text-gray-400'
                }`}>
                  {currentRoom.status === 'waiting' ? 'WAITING' : currentRoom.status === 'playing' ? 'PLAYING' : 'FINISHED'}
                </span>
                {/* FIXED: Single game mode display */}
                <span className={`ml-2 ${modeInfo.color} font-bold`}>
                  • {modeInfo.text}
                </span>
              </p>
              <div className="mt-4">
                <p className="text-sm font-medium text-cyber-cyan font-mono mb-2">CONNECTED_NODES:</p>
                <div className="flex flex-wrap gap-2">
                  {currentRoom.players && currentRoom.players.map(player => (
                    <span 
                      key={player.id} 
                      className={`px-3 py-1 rounded-full text-sm font-mono border ${
                        player.isReady 
                          ? 'bg-cyber-green/20 text-cyber-green border-cyber-green/50' 
                          : 'bg-black/50 border-cyber-cyan/30 text-gray-300'
                      }`}
                    >
                      {player.name} {player.isReady ? '✓' : '○'}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-3 min-w-[200px]">
              {isCurrentPlayerInRoom() ? (
                <>
                  <Button 
                    onClick={handleToggleReady}
                    className={`w-full font-mono font-bold ${
                      isCurrentPlayerReady() 
                        ? "bg-cyber-yellow/20 text-cyber-yellow border border-cyber-yellow/50 hover:bg-cyber-yellow/30" 
                        : "bg-gradient-to-r from-cyber-green to-cyber-cyan hover:from-cyber-cyan hover:to-cyber-green text-black border border-cyber-green/50"
                    }`}
                    variant={isCurrentPlayerReady() ? "outline" : "default"}
                    disabled={gameStarting}
                  >
                    <Zap className="mr-2 h-4 w-4" />
                    {isCurrentPlayerReady() ? "CANCEL_READY" : "SET_READY"}
                  </Button>
                  
                  <Button 
                    onClick={handleStartGame}
                    disabled={currentRoom.status !== 'waiting' || !currentRoom.players || currentRoom.players.length < 2 || !isCurrentPlayerReady() || gameStarting}
                    className="w-full bg-gradient-to-r from-cyber-magenta to-cyber-purple hover:from-cyber-purple hover:to-cyber-magenta text-white font-mono font-bold border border-cyber-magenta/50"
                  >
                    <Play className="mr-2 h-4 w-4" />
                    {gameStarting ? "LAUNCHING..." : "START_GAME"}
                  </Button>
                  
                  <Button 
                    variant="outline" 
                    onClick={handleLeaveRoom}
                    className="w-full font-mono font-bold text-cyber-magenta border-cyber-magenta/50 hover:bg-cyber-magenta/10 hover:border-cyber-magenta"
                    disabled={gameStarting}
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    LEAVE_ROOM
                  </Button>
                </>
              ) : (
                <Button 
                  onClick={() => handleJoinRoom(currentRoom.id)}
                  disabled={!currentRoom.players || currentRoom.players.length >= currentRoom.maxPlayers || currentRoom.status !== 'waiting'}
                  className="w-full bg-gradient-to-r from-cyber-cyan to-cyber-magenta hover:from-cyber-magenta hover:to-cyber-cyan text-black font-mono font-bold border border-cyber-cyan/50"
                >
                  <Users className="mr-2 h-4 w-4" />
                  JOIN_ROOM
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
