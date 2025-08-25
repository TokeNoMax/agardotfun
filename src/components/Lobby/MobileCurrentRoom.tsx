import { Button } from "@/components/ui/button";
import { useGame } from "@/context/GameContext";
import { GameRoom } from "@/types/game";
import { Zap, Users, LogOut, Crown, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useState } from "react";

interface MobileCurrentRoomProps {
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

export default function MobileCurrentRoom({
  currentRoom,
  countdown,
  gameStarting,
  handleToggleReady,
  handleLeaveRoom,
  handleJoinGame,
  handleJoinRoom,
  isCurrentPlayerReady,
  isCurrentPlayerInRoom
}: MobileCurrentRoomProps) {
  const { player } = useGame();
  const [isTogglingReady, setIsTogglingReady] = useState(false);
  
  const handleReadyToggleWithFeedback = async () => {
    if (isTogglingReady) return; // Éviter les clics multiples
    
    setIsTogglingReady(true);
    try {
      await handleToggleReady();
    } finally {
      // Délai pour éviter les clics trop rapides
      setTimeout(() => setIsTogglingReady(false), 1000);
    }
  };
  
  // Game mode display
  const getGameModeDisplay = (gameMode?: string) => {
    const normalizedMode = gameMode?.toLowerCase().trim();
    
    switch (normalizedMode) {
      case 'battle_royale':
        return { text: 'BATTLE_ROYALE', color: 'text-cyber-purple', icon: '⚔️' };
      case 'classic':
        return { text: 'CLASSIC', color: 'text-cyber-green', icon: '🎯' };
      default:
        return { text: 'CLASSIC', color: 'text-cyber-green', icon: '🎯' };
    }
  };
  
  const modeInfo = getGameModeDisplay(currentRoom.gameMode);
  
  // Check if all players are ready
  const areAllPlayersReady = (): boolean => {
    if (!currentRoom.players || currentRoom.players.length === 0) return false;
    return currentRoom.players.every(player => player.isReady);
  };
  
  // Check if room is full
  const isRoomFull = (): boolean => {
    return currentRoom.players && currentRoom.players.length >= currentRoom.maxPlayers;
  };
  
  const playerInRoom = isCurrentPlayerInRoom();
  const playerReady = isCurrentPlayerReady();
  
  return (
    <div className="space-y-4">
      {/* Room Header Card */}
      <Card className="bg-black/80 backdrop-blur-sm border-cyber-cyan/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-cyber-cyan font-mono text-lg flex items-center justify-between">
            <span>{currentRoom.name}</span>
            <span className={`text-sm ${modeInfo.color}`}>
              {modeInfo.icon} {modeInfo.text}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Room Status */}
          <div className="flex items-center justify-between text-sm font-mono">
            <span className="text-gray-300">
              <Users className="inline h-4 w-4 mr-1" />
              {currentRoom.players?.length || 0}/{currentRoom.maxPlayers} joueurs
            </span>
            <span className={`${
              currentRoom.status === 'waiting' ? 'text-cyber-yellow' : 
              currentRoom.status === 'playing' ? 'text-cyber-green' : 'text-gray-400'
            }`}>
              {currentRoom.status === 'waiting' ? 'EN_ATTENTE' : 
               currentRoom.status === 'playing' ? 'EN_JEU' : 'TERMINÉ'}
            </span>
          </div>

          {/* Players Grid */}
          <div>
            <p className="text-xs font-medium text-cyber-cyan font-mono mb-2">JOUEURS CONNECTÉS:</p>
            <div className="grid grid-cols-2 gap-2">
              {currentRoom.players?.map(roomPlayer => (
                <div 
                  key={roomPlayer.id} 
                  className={`p-2 rounded-lg text-xs font-mono border ${
                    roomPlayer.isReady 
                      ? 'bg-cyber-green/20 text-cyber-green border-cyber-green/50' 
                      : 'bg-black/50 border-cyber-cyan/30 text-gray-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="truncate">{roomPlayer.name}</span>
                    <span className="ml-1">
                      {roomPlayer.isReady ? '✓' : '○'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Status Message */}
          {currentRoom.players && currentRoom.players.length > 0 && (
            <div className="p-3 rounded-lg border border-cyber-cyan/30 bg-black/30">
              {!isRoomFull() ? (
                <p className="text-cyber-orange font-mono text-xs text-center">
                  ⚠️ {currentRoom.maxPlayers - (currentRoom.players?.length || 0)} joueur(s) manquant(s)
                </p>
              ) : areAllPlayersReady() ? (
                <p className="text-cyber-green font-mono text-xs text-center animate-pulse">
                  ✓ Tous prêts ! Démarrage automatique...
                </p>
              ) : (
                <p className="text-cyber-yellow font-mono text-xs text-center">
                  ⏳ En attente des autres joueurs ({currentRoom.players.filter(p => p.isReady).length}/{currentRoom.players.length} prêts)
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="space-y-3">
        {playerInRoom ? (
          // Player IS in the room
          <>
            <Button 
              onClick={handleReadyToggleWithFeedback}
              className={`w-full font-mono font-bold h-12 transition-all duration-300 ${
                playerReady 
                  ? "bg-cyber-yellow/20 text-cyber-yellow border border-cyber-yellow/50 hover:bg-cyber-yellow/30" 
                  : "bg-gradient-to-r from-cyber-green to-cyber-cyan hover:from-cyber-cyan hover:to-cyber-green text-black border border-cyber-green/50"
              }`}
              variant={playerReady ? "outline" : "default"}
              disabled={gameStarting || currentRoom.status !== 'waiting' || isTogglingReady}
            >
              {isTogglingReady ? (
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              ) : (
                <Zap className="mr-2 h-5 w-5" />
              )}
              {isTogglingReady ? "MISE À JOUR..." : playerReady ? "ANNULER READY" : "JE SUIS PRÊT"}
            </Button>
            
            <Button 
              variant="outline" 
              onClick={handleLeaveRoom}
              className="w-full h-12 font-mono font-bold text-cyber-magenta border-cyber-magenta/50 hover:bg-cyber-magenta/10 hover:border-cyber-magenta"
              disabled={gameStarting}
            >
              <LogOut className="mr-2 h-5 w-5" />
              QUITTER LA SALLE
            </Button>
          </>
        ) : (
          // Player is NOT in the room
          <div className="text-center space-y-3">
            <p className="text-cyber-cyan font-mono text-sm">
              Vous n'êtes pas dans cette salle
            </p>
            <Button 
              onClick={() => handleJoinRoom(currentRoom.id)}
              disabled={
                !currentRoom.players || 
                currentRoom.players.length >= currentRoom.maxPlayers || 
                currentRoom.status !== 'waiting'
              }
              className="w-full h-12 bg-gradient-to-r from-cyber-cyan to-cyber-magenta hover:from-cyber-magenta hover:to-cyber-cyan text-black font-mono font-bold border border-cyber-cyan/50"
            >
              <Users className="mr-2 h-5 w-5" />
              {currentRoom.players && currentRoom.players.length >= currentRoom.maxPlayers ? "SALLE PLEINE" : "REJOINDRE"}
            </Button>
          </div>
        )}

        {/* Join game button for playing status */}
        {currentRoom.status === 'playing' && (
          <Button
            onClick={handleJoinGame}
            className="w-full h-12 bg-gradient-to-r from-cyber-green to-cyber-cyan text-black font-mono font-bold"
          >
            <Crown className="mr-2 h-5 w-5" />
            REJOINDRE LA PARTIE
          </Button>
        )}
      </div>

      {/* Countdown Display */}
      {gameStarting && countdown !== null && countdown > 0 && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center">
          <div className="text-center">
            <div className="text-6xl font-bold text-cyber-cyan mb-4 animate-pulse">
              {countdown}
            </div>
            <p className="text-cyber-green font-mono">
              DÉMARRAGE DE LA PARTIE...
            </p>
          </div>
        </div>
      )}
    </div>
  );
}