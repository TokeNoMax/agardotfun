
import { Button } from "@/components/ui/button";
import { Users, Play, Lock, Zap } from "lucide-react";
import { GameRoom } from "@/types/game";
import { useGame } from "@/context/GameContext";

interface RoomListProps {
  rooms: GameRoom[];
  currentRoomId?: string;
  handleJoinRoom: (roomId: string) => Promise<void>;
  handleJoinGame: () => void;
}

export default function RoomList({ 
  rooms, 
  currentRoomId, 
  handleJoinRoom,
  handleJoinGame 
}: RoomListProps) {
  const { player } = useGame();

  console.log("AvailableRooms - Rooms updated:", rooms);
  console.log("Number of rooms:", rooms.length);
  console.log("First room:", rooms[0]);

  const getGameModeDisplay = (gameMode?: string) => {
    console.log("getGameModeDisplay called with:", gameMode);
    
    const normalizedMode = gameMode?.toLowerCase().trim();
    
    switch (normalizedMode) {
      case 'battle_royale':
        return { 
          text: 'BATTLE_ROYALE', 
          className: 'bg-cyber-purple/20 text-cyber-purple border-cyber-purple/50' 
        };
      case 'classic':
        return { 
          text: 'CLASSIC', 
          className: 'bg-cyber-green/20 text-cyber-green border-cyber-green/50' 
        };
      default:
        console.warn("getGameModeDisplay - Unknown game mode:", gameMode);
        return { 
          text: 'CLASSIC', 
          className: 'bg-cyber-green/20 text-cyber-green border-cyber-green/50' 
        };
    }
  };

  // IMPROVED: More robust player detection (same logic as CurrentRoom.tsx)
  const isCurrentPlayerInRoom = (room: GameRoom) => {
    if (!player || !room.players) {
      console.log("RoomList - No player or no room players for room:", room.name);
      return false;
    }
    
    // Check both player ID and wallet address for better detection
    const playerInRoom = room.players.some(p => {
      const idMatch = p.id === player.id;
      const walletMatch = p.id === player.walletAddress;
      const nameMatch = p.name === player.name;
      
      console.log("RoomList - Player comparison for room", room.name, ":", {
        roomPlayer: { id: p.id, name: p.name },
        currentPlayer: { id: player.id, walletAddress: player.walletAddress, name: player.name },
        idMatch,
        walletMatch,
        nameMatch
      });
      
      return idMatch || walletMatch || (nameMatch && p.name.trim() !== '');
    });
    
    console.log("RoomList - Player in room result for", room.name, ":", playerInRoom);
    return playerInRoom;
  };

  if (!rooms || rooms.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-400 font-mono">Aucune salle disponible</p>
      </div>
    );
  }

  console.log("Rendering AvailableRooms with", rooms.length, "rooms");

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-cyber-cyan font-mono mb-4">SALLES_DISPONIBLES</h2>
      {rooms.map((room) => {
        const modeInfo = getGameModeDisplay(room.gameMode);
        const isCurrentRoom = room.id === currentRoomId;
        const playerInThisRoom = isCurrentPlayerInRoom(room);
        
        console.log(`Room ${room.name} - gameMode: ${room.gameMode}`);
        console.log(`Rendering room ${room.name} with gameMode: ${room.gameMode} | modeInfo:`, modeInfo);

        return (
          <div 
            key={room.id} 
            className={`relative group ${isCurrentRoom ? 'ring-2 ring-cyber-magenta' : ''}`}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-cyber-cyan/10 to-cyber-green/10 rounded-lg blur group-hover:blur-none transition-all duration-300"></div>
            <div className="relative bg-black/60 backdrop-blur-sm border border-cyber-cyan/30 rounded-lg p-4 hover:border-cyber-cyan/60 transition-all duration-300 hover:shadow-[0_0_15px_rgba(0,255,255,0.3)]">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-bold text-cyber-cyan font-mono">{room.name}</h3>
                    {isCurrentRoom && (
                      <span className="px-2 py-1 text-xs bg-cyber-magenta/20 text-cyber-magenta border border-cyber-magenta/50 rounded font-mono">
                        CURRENT
                      </span>
                    )}
                    <span className={`px-2 py-1 text-xs rounded font-mono border ${modeInfo.className}`}>
                      {modeInfo.text}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-4 text-sm text-gray-300 font-mono">
                    <span className="flex items-center gap-1">
                      <Users className="h-4 w-4" />
                      {room.players ? room.players.length : 0}/{room.maxPlayers}
                    </span>
                    <span className={`${
                      room.status === 'waiting' ? 'text-cyber-yellow' : 
                      room.status === 'playing' ? 'text-cyber-green' : 'text-gray-400'
                    }`}>
                      {room.status === 'waiting' ? 'EN_ATTENTE' : 
                       room.status === 'playing' ? 'EN_JEU' : 'TERMINÉ'}
                    </span>
                  </div>

                  {room.players && room.players.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {room.players.map(roomPlayer => (
                        <span 
                          key={roomPlayer.id} 
                          className={`px-2 py-1 rounded text-xs font-mono border ${
                            roomPlayer.isReady 
                              ? 'bg-cyber-green/20 text-cyber-green border-cyber-green/50' 
                              : 'bg-black/50 border-cyber-cyan/30 text-gray-300'
                          }`}
                        >
                          {roomPlayer.name} {roomPlayer.isReady ? '✓' : '○'}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  {isCurrentRoom ? (
                    playerInThisRoom ? (
                      <Button 
                        onClick={handleJoinGame}
                        disabled={room.status !== 'playing'}
                        className="bg-gradient-to-r from-cyber-magenta to-cyber-purple hover:from-cyber-purple hover:to-cyber-magenta text-white font-mono font-bold border border-cyber-magenta/50"
                      >
                        <Play className="mr-2 h-4 w-4" />
                        REJOINDRE_PARTIE
                      </Button>
                    ) : (
                      <div className="text-cyber-yellow font-mono text-sm">
                        SALLE_ACTUELLE
                      </div>
                    )
                  ) : (
                    <Button 
                      onClick={() => handleJoinRoom(room.id)}
                      disabled={
                        !room.players || 
                        room.players.length >= room.maxPlayers || 
                        room.status !== 'waiting'
                      }
                      className={`font-mono font-bold ${
                        !room.players || 
                        room.players.length >= room.maxPlayers || 
                        room.status !== 'waiting'
                          ? 'bg-gray-600 text-gray-400 cursor-not-allowed' 
                          : 'bg-gradient-to-r from-cyber-cyan to-cyber-magenta hover:from-cyber-magenta hover:to-cyber-cyan text-black border border-cyber-cyan/50'
                      }`}
                    >
                      {room.status !== 'waiting' ? (
                        <>
                          <Lock className="mr-2 h-4 w-4" />
                          FERMÉE
                        </>
                      ) : !room.players || room.players.length >= room.maxPlayers ? (
                        <>
                          <Users className="mr-2 h-4 w-4" />
                          COMPLÈTE
                        </>
                      ) : (
                        <>
                          <Zap className="mr-2 h-4 w-4" />
                          REJOINDRE
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
