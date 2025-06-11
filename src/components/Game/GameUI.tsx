import React, { useState, useCallback, useMemo } from 'react';
import Canvas from './Canvas';
import Leaderboard from './Leaderboard';
import GameOverModal from './GameOverModal';
import QuitButton from './QuitButton';
import ZoneCounter from './ZoneCounter';
import { Player, Food, Rug, SafeZone } from '@/types/game';

interface GameUIProps {
  players: Record<string, Player>;
  bots?: Record<string, Player>; // Add bots prop
  foods: Food[];
  rugs: Rug[];
  currentPlayer: Player | null;
  onCollectFood: (foodId: string) => void;
  onCollision: (winnerId: string, loserId: string) => void;
  onGameOver: (winner: Player | null) => void;
  onScoreUpdate?: (playerId: string, newSize: number) => void;
  safeZone?: SafeZone;
  isLocalMode?: boolean;
  isZoneMode?: boolean;
  gameMode?: 'multiplayer' | 'zone' | 'local';
}

const GameUI: React.FC<GameUIProps> = ({
  players,
  bots = {},
  foods,
  rugs,
  currentPlayer,
  onCollectFood,
  onCollision,
  onGameOver,
  onScoreUpdate,
  safeZone,
  isLocalMode = false,
  isZoneMode = false,
  gameMode = 'multiplayer'
}) => {
  const [gameOver, setGameOver] = useState(false);
  const [winner, setWinner] = useState<Player | null>(null);
  const [gameDuration, setGameDuration] = useState(0);
  const [finalSize, setFinalSize] = useState<number | undefined>(undefined);
  const [eliminationType, setEliminationType] = useState<'absorption' | 'zone' | 'timeout'>('absorption');
  const [gameStartTime, setGameStartTime] = useState(Date.now());
  const [localPlayers, setPlayers] = useState(players);

  // Enhanced effective players calculation that includes bots
  const effectivePlayers = useMemo(() => {
    const validPlayers: Record<string, Player> = {};
    
    // Add regular players
    Object.entries(players).forEach(([id, player]) => {
      if (player && 
          typeof player.name === 'string' && 
          player.name.trim() !== '' && 
          player.name !== 'undefined' &&
          typeof player.size === 'number' && 
          !isNaN(player.size) &&
          typeof player.x === 'number' && 
          !isNaN(player.x) &&
          typeof player.y === 'number' && 
          !isNaN(player.y)) {
        validPlayers[id] = player;
      }
    });

    // Add bots in local mode
    if (isLocalMode && bots) {
      Object.entries(bots).forEach(([id, bot]) => {
        if (bot && 
            typeof bot.name === 'string' && 
            bot.name.trim() !== '' &&
            typeof bot.size === 'number' && 
            !isNaN(bot.size) &&
            typeof bot.x === 'number' && 
            !isNaN(bot.x) &&
            typeof bot.y === 'number' && 
            !isNaN(bot.y) &&
            bot.isAlive) {
          validPlayers[id] = bot;
        }
      });
    }

    console.log(`[GameUI] Effective players: ${Object.keys(validPlayers).length} total (${Object.keys(players).length} players + ${Object.keys(bots).length} bots)`);
    return validPlayers;
  }, [players, bots, isLocalMode]);

  // Enhanced score update handler
  const handleScoreUpdate = useCallback((playerId: string, newSize: number) => {
    console.log(`[GameUI] Score update: ${playerId} -> ${newSize}`);
    onScoreUpdate?.(playerId, newSize);
    
    // Update local state for immediate UI feedback
    if (players[playerId]) {
      setPlayers(prev => ({
        ...prev,
        [playerId]: { ...prev[playerId], size: newSize }
      }));
    }
  }, [onScoreUpdate, players]);

  const handleGameOver = useCallback((winner: Player | null, eliminationType: 'absorption' | 'zone' | 'timeout' = 'absorption') => {
    console.log(`[GameUI] Game Over! Winner: ${winner?.name || 'No one'}`);
    setGameOver(true);
    setWinner(winner);
    setGameDuration(Date.now() - gameStartTime);
    setFinalSize(winner?.size);
    setEliminationType(eliminationType);
  }, [gameStartTime]);

  const handlePlayAgain = useCallback(() => {
    console.log("[GameUI] Play Again clicked");
    window.location.reload();
  }, []);

  const handleBackToLobby = useCallback(() => {
    console.log("[GameUI] Back to Lobby clicked");
    window.location.href = '/lobby';
  }, []);

  const isPlayerInZone = useMemo(() => {
    if (!currentPlayer || !safeZone) return false;
    const distance = Math.sqrt(
      Math.pow(currentPlayer.x - safeZone.x, 2) +
      Math.pow(currentPlayer.y - safeZone.y, 2)
    );
    return distance <= safeZone.currentRadius;
  }, [currentPlayer, safeZone]);

  const timeUntilShrink = useMemo(() => {
    if (!safeZone || !safeZone.nextShrinkTime) return 0;
    return Math.max(0, safeZone.nextShrinkTime - Date.now());
  }, [safeZone]);

  return (
    <div className="relative w-full h-full">
      <Canvas
        players={effectivePlayers}
        foods={foods}
        rugs={rugs}
        onCollectFood={onCollectFood}
        onCollision={onCollision}
        onScoreUpdate={handleScoreUpdate}
        safeZone={safeZone}
        isLocalMode={isLocalMode}
        isZoneMode={isZoneMode}
        gameMode={gameMode}
      />
      
      <div className="absolute top-4 left-4 z-10">
        <QuitButton isLocalMode={isLocalMode || false} />
      </div>
      
      {isZoneMode && safeZone && (
        <div className="absolute top-4 right-4 z-10">
          <ZoneCounter
            safeZone={safeZone}
            isPlayerInZone={isPlayerInZone}
            timeUntilShrink={timeUntilShrink}
          />
        </div>
      )}
      
      <Leaderboard
        players={effectivePlayers}
        currentPlayerId={currentPlayer?.id}
        gameMode={gameMode || 'multiplayer'}
      />
      
      <GameOverModal
        open={gameOver}
        winner={winner}
        onPlayAgain={handlePlayAgain}
        onBackToLobby={handleBackToLobby}
        gameMode={gameMode}
        gameDuration={gameDuration}
        finalSize={finalSize}
        eliminationType={eliminationType}
      />
    </div>
  );
};

export default GameUI;
