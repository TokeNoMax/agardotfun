import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useWallet } from "@solana/wallet-adapter-react";
import { useGame } from "@/context/GameContext";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import GameUI from "@/components/Game/GameUI";
import { Player, GameRoom, Food, Rug, SafeZone } from "@/types/game";
import { generateName } from "@/utils/nameGenerator";
import { generateColor } from "@/utils/colorGenerator";
import { GameStateService } from "@/services/game/gameStateService";
import { MapGenerator } from "@/services/game/mapGenerator";
import GameOverModal from "@/components/Game/GameOverModal";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";

const Game = () => {
  const { roomId: roomIdParam } = useParams<{ roomId: string }>();
  const roomId = roomIdParam!;
  const navigate = useNavigate();
  const { publicKey } = useWallet();
  const {
    currentRoom,
    leaveRoom,
    refreshCurrentRoom,
  } = useGame();
  const { toast } = useToast();
  const isMobile = useIsMobile();

  const [localPlayers, setLocalPlayers] = useState<Record<string, Player>>({});
  const [localFoods, setLocalFoods] = useState<Food[]>([]);
  const [localRugs, setLocalRugs] = useState<Rug[]>([]);
  const [safeZone, setSafeZone] = useState<SafeZone | null>(null);
  const [gameState, setGameState] = useState<
    "loading" | "playing" | "gameOver"
  >("loading");
  const [winner, setWinner] = useState<Player | null>(null);
  const [isGameOverModalOpen, setIsGameOverModalOpen] = useState(false);
  const [gameDuration, setGameDuration] = useState(0);
  const [finalSize, setFinalSize] = useState<number | undefined>(undefined);
  const [eliminationType, setEliminationType] =
    useState<"absorption" | "zone" | "timeout">("absorption");

  const [isLocalMode, setIsLocalMode] = useState(false);
  const [isZoneMode, setIsZoneMode] = useState(false);
  const [gameMode, setGameMode] = useState<"classic" | "battle_royale">(
    "classic"
  );

  const [localBots, setLocalBots] = useState<Record<string, Player>>({});

  const currentPlayer = useMemo(() => {
    if (!publicKey) return null;
    return localPlayers[publicKey.toString()] || null;
  }, [publicKey, localPlayers]);

  const effectivePlayers = useMemo(() => {
    if (!currentRoom?.players) return {};

    const validPlayers: Record<string, Player> = {};
    currentRoom.players.forEach((player) => {
      if (
        player &&
        typeof player.name === "string" &&
        player.name.trim() !== "" &&
        player.name !== "undefined" &&
        typeof player.size === "number" &&
        !isNaN(player.size) &&
        typeof player.x === "number" &&
        !isNaN(player.x) &&
        typeof player.y === "number" &&
        !isNaN(player.y)
      ) {
        validPlayers[player.id] = player;
      }
    });
    return validPlayers;
  }, [currentRoom?.players]);

  const realtimeSync = useRealtimeSync({
    roomId: roomId,
    playerId: publicKey?.toString(),
    enabled: !isLocalMode,
    players: localPlayers,
    createBlob: (id: string) => {
      const newPlayer: Player = {
        id: id,
        walletAddress: id,
        name: generateName(),
        color: generateColor(),
        size: 20,
        x: Math.random() * 2000,
        y: Math.random() * 1500,
        isAlive: true,
        velocityX: 0,
        velocityY: 0,
      };
      return {
        setPos: (x: number, y: number) => {
          setLocalPlayers((prev) => {
            const updatedPlayer = { ...prev[id], x, y };
            return { ...prev, [id]: updatedPlayer };
          });
        },
        setSize: (r: number) => {
          setLocalPlayers((prev) => {
            const updatedPlayer = {
              ...prev[id],
              size: r,
            };
            return { ...prev, [id]: updatedPlayer };
          });
        },
      };
    },
    onConnectionChange: (isConnected) => {
      if (!isConnected) {
        toast({
          title: "DISCONNECTED",
          description: "Vous êtes déconnecté du serveur.",
          variant: "destructive",
        });
      }
    },
  });

  const initializeGame = useCallback(async () => {
    if (!currentRoom) {
      console.warn("No current room, navigating to lobby");
      navigate("/lobby");
      return;
    }

    setIsLocalMode(currentRoom.players.length <= 1);
    setIsZoneMode(currentRoom.gameMode === "battle_royale");
    setGameMode(currentRoom.gameMode || "classic");

    try {
      const gameState = await GameStateService.getGameState(roomId);
      if (!gameState) {
        console.error("Failed to get game state");
        return;
      }

      const map = MapGenerator.generateMap(gameState.mapSeed);
      setLocalFoods(
        map.foods.map((food) => ({
          id: food.id,
          x: food.x,
          y: food.y,
          size: food.size,
        }))
      );
      setLocalRugs(
        map.rugs.map((rug) => ({
          id: rug.id,
          x: rug.x,
          y: rug.y,
          size: rug.size,
        }))
      );

      // Initialize safe zone if in zone mode
      if (isZoneMode) {
        const initialSafeZone: SafeZone = {
          x: 1500,
          y: 1500,
          radius: 1000,
          currentRadius: 1000,
          maxRadius: 1000,
          nextShrinkTime: Date.now() + 120000, // 2 minutes
          shrinkDuration: 30000, // 30 seconds
          isActive: true,
          shrinkInterval: 120000, // 2 minutes
          damagePerSecond: 1,
          shrinkPercentage: 0.2,
        };
        setSafeZone(initialSafeZone);
      }

      // Initialize players
      const initialPlayers: Record<string, Player> = {};
      currentRoom.players.forEach((player, index) => {
        initialPlayers[player.id] = {
          ...player,
          x: player.x,
          y: player.y,
          size: player.size,
          isAlive: true,
        };
      });
      setLocalPlayers(initialPlayers);

      setGameState("playing");
    } catch (error) {
      console.error("Error initializing game:", error);
    }
  }, [roomId, navigate, currentRoom, isZoneMode]);

  useEffect(() => {
    if (currentRoom) {
      initializeGame();
    }
  }, [currentRoom, initializeGame]);

  useEffect(() => {
    if (gameState === "playing") {
      const startTime = Date.now();

      const gameTimer = setInterval(() => {
        setGameDuration(Date.now() - startTime);
      }, 1000);

      return () => clearInterval(gameTimer);
    }
  }, [gameState]);

  const handleCollectFood = useCallback(
    async (foodId: string) => {
      if (isLocalMode) {
        setLocalFoods((prevFoods) => prevFoods.filter((food) => food.id !== foodId));
      } else {
        await GameStateService.consumeFood(roomId, foodId);
        setLocalFoods((prevFoods) => prevFoods.filter((food) => food.id !== foodId));
      }
    },
    [roomId, isLocalMode]
  );

  const handleCollision = useCallback(
    (winnerId: string, loserId: string) => {
      setLocalPlayers((prevPlayers) => {
        const winner = { ...prevPlayers[winnerId] };
        const loser = { ...prevPlayers[loserId] };

        if (!winner || !loser) {
          console.warn("Winner or loser not found in local players");
          return prevPlayers;
        }

        // Winner absorbs loser
        winner.size += loser.size * 0.8;
        loser.isAlive = false;

        // Update local state
        const updatedPlayers = {
          ...prevPlayers,
          [winnerId]: winner,
          [loserId]: loser,
        };

        return updatedPlayers;
      });
    },
    [setLocalPlayers]
  );

  const handleGameOver = useCallback(
    (winner: Player | null) => {
      console.log("Game Over", winner);
      setWinner(winner);
      setGameState("gameOver");
      setIsGameOverModalOpen(true);
      setFinalSize(currentPlayer?.size);
    },
    [currentPlayer?.size]
  );

  const handlePlayAgain = () => {
    setIsGameOverModalOpen(false);
    navigate(`/lobby`);
  };

  const handleBackToLobby = async () => {
    setIsGameOverModalOpen(false);
    try {
      await leaveRoom();
      navigate("/lobby");
    } catch (error) {
      console.error("Error leaving room:", error);
      navigate("/lobby");
    }
  };

  const handleScoreUpdate = useCallback((playerId: string, newSize: number) => {
    console.log(`[Game] Score update for ${playerId}: ${newSize}`);
    
    // Update in local state for immediate feedback
    if (localPlayers[playerId]) {
      setLocalPlayers(prev => ({
        ...prev,
        [playerId]: { ...prev[playerId], size: newSize }
      }));
    }
    
    // Update bots if it's a bot
    if (playerId.startsWith('bot_')) {
      setLocalBots(prev => ({
        ...prev,
        [playerId]: { ...prev[playerId], size: newSize }
      }));
    }
    
    // Sync with realtime if in multiplayer
    if (realtimeSync?.updateLocalScore && currentPlayer?.id === playerId) {
      const radius = Math.sqrt(newSize);
      realtimeSync.updateLocalScore(radius);
    }
  }, [localPlayers, realtimeSync, currentPlayer?.id]);

  useEffect(() => {
    if (
      isZoneMode &&
      safeZone &&
      gameState === "playing" &&
      Object.keys(localPlayers).length > 0
    ) {
      const zoneInterval = setInterval(() => {
        setSafeZone((prevSafeZone) => {
          if (!prevSafeZone) return null;

          const now = Date.now();
          if (now >= prevSafeZone.nextShrinkTime) {
            const newRadius =
              prevSafeZone.currentRadius * (1 - prevSafeZone.shrinkPercentage);
            const nextShrinkTime = now + prevSafeZone.shrinkInterval;

            return {
              ...prevSafeZone,
              currentRadius: newRadius,
              nextShrinkTime: nextShrinkTime,
            };
          }
          return prevSafeZone;
        });
      }, 1000);

      return () => clearInterval(zoneInterval);
    }
  }, [isZoneMode, safeZone, gameState, localPlayers]);

  useEffect(() => {
    if (
      isZoneMode &&
      safeZone &&
      gameState === "playing" &&
      Object.keys(localPlayers).length > 0
    ) {
      let alivePlayers = Object.values(localPlayers).filter((p) => p.isAlive);

      if (alivePlayers.length <= 1) {
        const zoneWinner = alivePlayers[0] || null;
        setEliminationType("zone");
        handleGameOver(zoneWinner);
      }
    }
  }, [localPlayers, safeZone, isZoneMode, gameState, handleGameOver]);

  if (gameState === "loading") {
    return (
      <div className="flex items-center justify-center h-screen">
        <span className="loading loading-ring loading-lg"></span>
      </div>
    );
  }

  if (gameState === "playing") {
    // Convert game mode to the expected type
    const uiGameMode: 'multiplayer' | 'zone' | 'local' = 
      isLocalMode ? 'local' : 
      isZoneMode ? 'zone' : 
      'multiplayer';

    return (
      <GameUI
        players={effectivePlayers}
        bots={localBots}
        foods={localFoods}
        rugs={localRugs}
        currentPlayer={currentPlayer}
        onCollectFood={handleCollectFood}
        onCollision={handleCollision}
        onGameOver={handleGameOver}
        onScoreUpdate={handleScoreUpdate}
        safeZone={safeZone}
        isLocalMode={isLocalMode}
        isZoneMode={isZoneMode}
        gameMode={uiGameMode}
      />
    );
  }

  return (
    <GameOverModal
      open={isGameOverModalOpen}
      winner={winner}
      onPlayAgain={handlePlayAgain}
      onBackToLobby={handleBackToLobby}
      gameMode={isLocalMode ? "local" : isZoneMode ? "zone" : "multiplayer"}
      gameDuration={gameDuration}
      finalSize={finalSize}
      eliminationType={eliminationType}
    />
  );
};

export default Game;
