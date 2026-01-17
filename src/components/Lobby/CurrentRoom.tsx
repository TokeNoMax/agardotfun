
import { Button } from "@/components/ui/button";
import { useGame } from "@/context/GameContext";
import { GameRoom } from "@/types/game";
import { Zap, Users, LogOut } from "lucide-react";
import GhostRoomDetector from "./GhostRoomDetector";
import GameStartCountdown from "./GameStartCountdown";

interface CurrentRoomProps {
  currentRoom: GameRoom;
  countdown: number | null;
  gameStarting: boolean;
  handleToggleReady: () => Promise<void>;
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
  handleLeaveRoom,
  handleJoinGame,
  handleJoinRoom,
  isCurrentPlayerReady,
  isCurrentPlayerInRoom
}: CurrentRoomProps) {
  const { player } = useGame();
  
  // Game mode display
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
  
  // Check if all players are ready
  const areAllPlayersReady = (): boolean => {
    if (!currentRoom.players || currentRoom.players.length === 0) {
      return false;
    }
    
    // All players must be ready
    const allReady = currentRoom.players.every(player => player.isReady);
    console.log("CurrentRoom - areAllPlayersReady:", allReady);
    console.log("CurrentRoom - Players ready status:", currentRoom.players.map(p => ({ name: p.name, isReady: p.isReady })));
    
    return allReady;
  };
  
  // Check if room is full (all slots occupied)
  const isRoomFull = (): boolean => {
    return currentRoom.players && currentRoom.players.length >= currentRoom.maxPlayers;
  };
  
  // SIMPLIFIED: Use the prop function directly instead of creating our own
  const playerInRoom = isCurrentPlayerInRoom();
  const playerReady = isCurrentPlayerReady();
  
  // Enhanced Debug logging
  console.log("=== CurrentRoom RENDER ===");
  console.log("CurrentRoom - Player ID:", player?.id);
  console.log("CurrentRoom - Player Wallet:", player?.walletAddress);
  console.log("CurrentRoom - Player Name:", player?.name);
  console.log("CurrentRoom - Room Players:", currentRoom.players?.map(p => ({ 
    id: p.id, 
    name: p.name, 
    walletAddress: p.walletAddress,
    isReady: p.isReady 
  })));
  console.log("CurrentRoom - playerInRoom:", playerInRoom);
  console.log("CurrentRoom - playerReady:", playerReady);
  console.log("CurrentRoom - Room status:", currentRoom.status);
  console.log("CurrentRoom - Game starting:", gameStarting);
  console.log("CurrentRoom - All players ready:", areAllPlayersReady());
  console.log("CurrentRoom - Room is full:", isRoomFull());
  console.log("CurrentRoom - Button decision:", {
    showReadyButton: playerInRoom && currentRoom.status === 'waiting' && !gameStarting,
    playerInRoom,
    roomStatus: currentRoom.status,
    gameStarting
  });
  console.log("=== END CurrentRoom RENDER ===");
  
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
          <div className="flex flex-col gap-6">
            {/* Room info header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div className="flex-1">
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
                  <span className={`ml-2 ${modeInfo.color} font-bold`}>
                    • {modeInfo.text}
                  </span>
                </p>
              </div>
            </div>

            {/* Players list */}
            <div>
              <p className="text-sm font-medium text-cyber-cyan font-mono mb-3">CONNECTED_NODES:</p>
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
              
              {/* Ready status indicator - UPDATED LOGIC */}
              {currentRoom.players && currentRoom.players.length > 0 && (
                <div className="mt-3 p-3 rounded-lg border border-cyber-cyan/30">
                  {!isRoomFull() ? (
                    <p className="text-cyber-orange font-mono text-sm">
                      ⚠️ Il faut {currentRoom.maxPlayers} joueurs pour commencer cette partie ({currentRoom.players.length}/{currentRoom.maxPlayers})
                    </p>
                  ) : areAllPlayersReady() ? (
                    <p className="text-cyber-green font-mono text-sm">
                      ✓ Salle complète et tous les joueurs sont prêts ! Démarrage automatique...
                    </p>
                  ) : (
                    <p className="text-cyber-yellow font-mono text-sm">
                      ⏳ Salle complète ! En attente que tous les joueurs soient prêts ({currentRoom.players.filter(p => p.isReady).length}/{currentRoom.players.length})
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Action buttons - SIMPLIFIED WITHOUT START BUTTON */}
            <div className="flex flex-col gap-3">
              {playerInRoom ? (
                // Player IS in the room - show READY and LEAVE buttons only
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* Ready button */}
                  <Button 
                    onClick={handleToggleReady}
                    className={`font-mono font-bold ${
                      playerReady 
                        ? "bg-cyber-yellow/20 text-cyber-yellow border border-cyber-yellow/50 hover:bg-cyber-yellow/30" 
                        : "bg-gradient-to-r from-cyber-green to-cyber-cyan hover:from-cyber-cyan hover:to-cyber-green text-black border border-cyber-green/50"
                    }`}
                    variant={playerReady ? "outline" : "default"}
                    disabled={gameStarting || currentRoom.status !== 'waiting'}
                  >
                    <Zap className="mr-2 h-4 w-4" />
                    {playerReady ? "CANCEL_READY" : "SET_READY"}
                  </Button>
                  
                  {/* Leave room button */}
                  <Button 
                    variant="outline" 
                    onClick={handleLeaveRoom}
                    className="font-mono font-bold text-cyber-magenta border-cyber-magenta/50 hover:bg-cyber-magenta/10 hover:border-cyber-magenta"
                    disabled={gameStarting}
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    LEAVE_ROOM
                  </Button>
                </div>
              ) : (
                // Player is NOT in the room - show JOIN button
                <div className="text-center">
                  <p className="text-cyber-cyan font-mono mb-4">
                    Vous n'êtes pas encore dans cette salle
                  </p>
                  <Button 
                    onClick={() => handleJoinRoom(currentRoom.id)}
                    disabled={
                      !currentRoom.players || 
                      currentRoom.players.length >= currentRoom.maxPlayers || 
                      currentRoom.status !== 'waiting'
                    }
                    className="w-full bg-gradient-to-r from-cyber-cyan to-cyber-magenta hover:from-cyber-magenta hover:to-cyber-cyan text-black font-mono font-bold border border-cyber-cyan/50"
                  >
                    <Users className="mr-2 h-4 w-4" />
                    {currentRoom.players && currentRoom.players.length >= currentRoom.maxPlayers ? "ROOM_FULL" : "JOIN_ROOM"}
                  </Button>
                </div>
              )}

              {/* Join game button for playing status */}
              {currentRoom.status === 'playing' && (
                <Button
                  onClick={handleJoinGame}
                  className="w-full bg-gradient-to-r from-cyber-green to-cyber-cyan text-black font-mono font-bold"
                >
                  <Users className="mr-2 h-4 w-4" />
                  JOIN_GAME
                </Button>
              )}
            </div>

            {/* Debug Panel - À RETIRER EN PRODUCTION */}
            <div className="mt-4 p-3 bg-black/80 border border-red-500/50 rounded text-xs font-mono text-red-400">
              <p className="text-red-500 font-bold mb-2">🔧 DEBUG PANEL</p>
              <p>Player ID: {player?.id?.substring(0, 12)}...</p>
              <p>Player Wallet: {player?.walletAddress?.substring(0, 12)}...</p>
              <p>playerInRoom: <span className={playerInRoom ? "text-green-400" : "text-red-400"}>{String(playerInRoom)}</span></p>
              <p>playerReady: <span className={playerReady ? "text-green-400" : "text-red-400"}>{String(playerReady)}</span></p>
              <p>Room Status: {currentRoom.status}</p>
              <p>Players Count: {currentRoom.players?.length}/{currentRoom.maxPlayers}</p>
              <p>Room Players IDs: {currentRoom.players?.map(p => p.id.substring(0, 8)).join(', ')}</p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
