
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useGame } from "@/context/GameContext";
import Canvas from "./Canvas";
import GameOverModal from "./GameOverModal";
import Leaderboard from "./Leaderboard";
import ZoneCounter from "./ZoneCounter";
import { Player, SafeZone } from "@/types/game";
import { useNavigate, useLocation } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

export default function GameUI() {
  const { currentRoom, leaveRoom, player } = useGame();
  const [isGameOver, setIsGameOver] = useState(false);
  const [winner, setWinner] = useState<Player | null>(null);
  const [alivePlayers, setAlivePlayers] = useState<number>(0);
  const [localMode, setLocalMode] = useState<boolean>(false);
  const [localPlayer, setLocalPlayer] = useState<Player | null>(null);
  const [isZoneMode, setIsZoneMode] = useState<boolean>(false);
  const [currentZone, setCurrentZone] = useState<SafeZone | null>(null);
  const [isPlayerInZone, setIsPlayerInZone] = useState<boolean>(true);
  const [timeUntilShrink, setTimeUntilShrink] = useState<number>(0);
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  
  // Check if we're in local mode based on URL parameters - seulement une fois au chargement
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const isLocalMode = urlParams.get('local') === 'true';
    const gameMode = urlParams.get('mode');
    const isZoneBattle = gameMode === 'zone';
    
    if (isLocalMode || isZoneBattle) {
      // Create a local player if in local mode
      setLocalMode(true);
      setIsZoneMode(isZoneBattle);
      setLocalPlayer({
        id: "local-player",
        walletAddress: "local-player", // Add required walletAddress for local mode
        name: player?.name || "LocalPlayer",
        color: player?.color || "blue",
        size: 15,
        x: 1500, // Centré sur la nouvelle taille du jeu
        y: 1500, // Centré sur la nouvelle taille du jeu
        isAlive: true
      });
      
      setAlivePlayers(1);
    } else if (currentRoom) {
      // Normal online mode - use currentRoom - seulement une mise à jour initiale
      const alive = currentRoom.players.filter(p => p.isAlive).length;
      setAlivePlayers(alive || currentRoom.players.length);
    }
  }, []);

  // Mise à jour des joueurs en vie uniquement lorsque le statut des joueurs change
  useEffect(() => {
    if (!localMode && currentRoom) {
      const alive = currentRoom.players.filter(p => p.isAlive).length;
      setAlivePlayers(alive || currentRoom.players.length);
    }
  }, [currentRoom?.players, localMode]);

  // Redirect if not in local mode and no valid session
  useEffect(() => {
    if (!localMode && (!currentRoom || !player || !currentRoom.players.some(p => p.id === player.id))) {
      const timer = setTimeout(() => {
        navigate('/lobby');
      }, 500);
      
      return () => clearTimeout(timer);
    }
  }, [currentRoom, player, navigate, localMode]);

  // Handle zone updates from Canvas
  const handleZoneUpdate = (zone: SafeZone, playerInZone: boolean) => {
    setCurrentZone(zone);
    setIsPlayerInZone(playerInZone);
    setTimeUntilShrink(zone.nextShrinkTime - Date.now());
  };

  const handleGameOver = (winner: Player | null) => {
    setWinner(winner);
    setIsGameOver(true);
    
    // Store game result in localStorage
    if (currentRoom) {
      localStorage.setItem('blob-battle-game-state', JSON.stringify({
        status: 'finished',
        roomId: currentRoom.id,
        winner: winner ? winner.name : 'Nobody'
      }));
    }
  };
  
  const handlePlayAgain = async () => {
    if (localMode) {
      // For local mode, just reset the game
      window.location.reload();
    } else {
      // Clean up the game state
      localStorage.removeItem('blob-battle-game-state');
      
      // Online mode - leave room and go back to lobby
      await leaveRoom();
      setIsGameOver(false);
      navigate('/lobby');
    }
  };
  
  const handleBackToLobby = async () => {
    // Clean up the game state
    localStorage.removeItem('blob-battle-game-state');
    
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
  
  // Handle player eaten event - show toast with meme
  const handlePlayerEaten = (eatenPlayer: Player, eaterPlayer: Player) => {
    // We already handle this in the Leaderboard component with animated toasts
    // This is just a hook for future functionality if needed
    console.log(`${eatenPlayer.name} was eaten by ${eaterPlayer.name}`);
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
      <div className="absolute top-4 left-4 bg-black/80 backdrop-blur-sm p-3 rounded-md shadow-md z-10 text-white">
        <div className="text-sm font-medium">
          {localMode ? (isZoneMode ? "Mode Zone Battle" : "Mode Solo Local") : `Joueurs en vie: ${alivePlayers}`}
        </div>
        {!localMode && currentRoom && (
          <div className="text-sm font-medium">Salle: {currentRoom.name}</div>
        )}
        <div className="text-sm font-medium">
          Vous: {localMode ? localPlayer?.name : player?.name}
        </div>
      </div>
      
      {/* Zone Counter for Zone Battle mode */}
      {isZoneMode && currentZone && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-10">
          <ZoneCounter 
            safeZone={currentZone}
            isPlayerInZone={isPlayerInZone}
            timeUntilShrink={timeUntilShrink}
          />
        </div>
      )}
      
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
      
      {/* Leaderboard - with player eaten callback */}
      <div className="absolute top-4 right-20 z-10">
        <Leaderboard 
          players={localMode ? (localPlayer ? [localPlayer] : []) : (currentRoom ? currentRoom.players : [])} 
          currentPlayerId={localMode ? localPlayer?.id : player?.id}
          onPlayerEaten={handlePlayerEaten}
        />
      </div>
      
      {/* Game canvas */}
      <div className="w-full h-full">
        <Canvas 
          onGameOver={handleGameOver} 
          isLocalMode={localMode}
          localPlayer={localPlayer}
          isZoneMode={isZoneMode}
          onZoneUpdate={handleZoneUpdate}
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
