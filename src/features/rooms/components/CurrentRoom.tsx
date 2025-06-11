
import React, { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useGame } from "@/context/GameContext";
import { useNavigate } from "react-router-dom";
import { Users, Play, LogOut, Crown, Target } from "lucide-react";
import { GameRoom } from "@/types/game";
import { useToast } from "@/hooks/use-toast";

interface CurrentRoomProps {
  currentRoom: GameRoom;
  playerId: string;
}

export default function CurrentRoom({ currentRoom, playerId }: CurrentRoomProps) {
  const { leaveRoom, refreshCurrentRoom } = useGame();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const interval = setInterval(() => {
      refreshCurrentRoom();
    }, 2000);

    return () => clearInterval(interval);
  }, [refreshCurrentRoom]);

  const handleStartGame = () => {
    if (currentRoom.players.length < 2) {
      toast({
        title: "Pas assez de joueurs",
        description: "Il faut au moins 2 joueurs pour commencer une partie.",
        variant: "destructive",
      });
      return;
    }
    
    navigate(`/game/${currentRoom.id}`);
  };

  const handleLeaveRoom = async () => {
    try {
      await leaveRoom();
      toast({
        title: "Salle quittée",
        description: "Vous avez quitté la salle avec succès.",
      });
    } catch (error) {
      console.error("Error leaving room:", error);
      toast({
        title: "Erreur",
        description: "Impossible de quitter la salle.",
        variant: "destructive",
      });
    }
  };

  const getGameModeInfo = (gameMode?: string) => {
    switch (gameMode) {
      case 'battle_royale':
        return {
          icon: <Crown className="w-4 h-4" />,
          label: "BATTLE ROYALE",
          description: "Zone mortelle qui rétrécit",
          className: "bg-gradient-to-r from-cyber-purple to-cyber-magenta text-white"
        };
      default:
        return {
          icon: <Target className="w-4 h-4" />,
          label: "CLASSIC",
          description: "Mode classique",
          className: "bg-gradient-to-r from-cyber-green to-cyber-cyan text-black"
        };
    }
  };

  const modeInfo = getGameModeInfo(currentRoom.gameMode);

  return (
    <Card className="w-full bg-black/90 backdrop-blur-sm border-cyber-cyan/50 shadow-[0_0_20px_rgba(0,255,255,0.2)]">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-cyber-cyan font-mono flex items-center gap-2">
            <Users className="w-5 h-5" />
            {currentRoom.name}
          </CardTitle>
          <Badge className={`font-mono font-bold ${modeInfo.className}`}>
            {modeInfo.icon}
            {modeInfo.label}
          </Badge>
        </div>
        <p className="text-sm text-gray-400 font-mono">
          {modeInfo.description}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-cyber-green font-mono">PLAYERS</span>
            <span className="text-cyber-cyan font-mono">
              {currentRoom.players.length}/{currentRoom.maxPlayers}
            </span>
          </div>
          
          <div className="space-y-2 max-h-32 overflow-y-auto">
            {currentRoom.players.map((player, index) => (
              <div 
                key={player.id} 
                className={`flex items-center gap-3 p-2 rounded ${
                  player.id === playerId 
                    ? 'bg-cyber-cyan/20 border border-cyber-cyan/50' 
                    : 'bg-gray-800/50'
                }`}
              >
                <div 
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm"
                  style={{ backgroundColor: `#${getColorHex(player.color)}` }}
                >
                  {player.name ? player.name.substring(0, 2).toUpperCase() : '??'}
                </div>
                <span className="text-white font-mono text-sm flex-1">
                  {player.name || 'Player'} {player.id === playerId && '(Vous)'}
                </span>
                {player.isReady && (
                  <Badge className="bg-cyber-green/20 text-cyber-green border-cyber-green/50 text-xs">
                    READY
                  </Badge>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            onClick={handleStartGame}
            className="flex-1 bg-gradient-to-r from-cyber-green to-cyber-cyan text-black hover:from-cyber-cyan hover:to-cyber-green font-mono font-bold"
          >
            <Play className="mr-2 h-4 w-4" />
            START_GAME
          </Button>
          <Button
            onClick={handleLeaveRoom}
            variant="outline"
            className="text-red-400 border-red-400/50 hover:bg-red-400/10 font-mono"
          >
            <LogOut className="mr-2 h-4 w-4" />
            LEAVE
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// Helper function to get color hex values
function getColorHex(color: string): string {
  const colorMap: Record<string, string> = {
    blue: '3498db',
    red: 'e74c3c',
    green: '2ecc71',
    yellow: 'f1c40f',
    purple: '9b59b6',
    orange: 'e67e22',
    cyan: '1abc9c',
    pink: 'fd79a8'
  };
  return colorMap[color] || '3498db';
}
