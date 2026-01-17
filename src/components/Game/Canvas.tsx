import React, { useRef, useEffect, useState, useImperativeHandle, forwardRef, useCallback } from "react";
import { useGame } from "@/context/GameContext";
import { Food, Rug, Player, SafeZone } from "@/types/game";
import { useIsMobile } from "@/hooks/use-mobile";
import { OptimizedPlayerPosition } from "@/services/realtime/optimizedGameSync";
import { MapGenerator, GeneratedMap } from "@/services/game/mapGenerator";
import { GameStateService, GameState } from "@/services/game/gameStateService";
import { BotService, Bot } from "@/services/game/botService";
import { computeSpeed } from "@/services/game/speedUtil";
import { EliminationNotificationService } from "@/services/eliminationNotificationService";
import { handleBotElimination, handleZoneDeath, handleBotVsBotElimination, handleBotZoneDeath } from "./EliminationHandler";

// Constants
const GAME_WIDTH = 3000;
const GAME_HEIGHT = 3000;
const FOOD_SIZE = 5;
const RUG_SIZE = 40;
const FOOD_VALUE = 1;
const RUG_PENALTY = 5;
const GRID_SIZE = 150;
const GRID_COLOR = "#333333";

// Zone Battle constants
const ZONE_SHRINK_INTERVAL = 120000;
const ZONE_DAMAGE_PER_SECOND = 3;
const ZONE_SHRINK_PERCENTAGE = 0.2;
const INITIAL_ZONE_RADIUS = 1400;

// Zoom constants - optimized for better dynamic zoom experience
const MIN_ZOOM = 0.25;  // Reduced from 0.3 for wider view with larger blobs
const MAX_ZOOM = 2.5;   // Increased from 2.0 for closer view with smaller blobs
const ZOOM_SMOOTH_FACTOR = 0.12;  // Increased from 0.08 for more responsive zoom

// Network position for debug visualization
export interface NetworkPosition {
  x: number;
  y: number;
  size: number;
  timestamp: number;
}

interface CanvasProps {
  onGameOver: (winner: Player | null, eliminationType?: 'absorption' | 'zone' | 'timeout') => void;
  isLocalMode?: boolean;
  localPlayer?: Player | null;
  isZoneMode?: boolean;
  onZoneUpdate?: (zone: SafeZone, isPlayerInZone: boolean) => void;
  onPlayerPositionSync?: (position: { x: number; y: number; size: number }) => void;
  onPlayerInput?: (moveX: number, moveY: number, boost?: boolean) => void;
  onPlayerCollision?: (eliminatedPlayerId: string, eliminatorPlayerId: string, eliminatedSize: number, eliminatorNewSize: number) => Promise<void>;
  onPlayerElimination?: (eliminatedPlayerId: string, eliminatorPlayerId: string) => Promise<void>;
  getInterpolatedPosition?: (playerId: string) => { x: number; y: number; size: number } | null;
  roomId?: string;
  debugMode?: boolean;
  networkPositions?: Map<string, NetworkPosition>;
  onFpsUpdate?: (fps: number) => void;
}

export interface CanvasRef {
  setMobileDirection: (direction: { x: number; y: number } | null) => void;
  updatePlayerPosition: (playerId: string, position: OptimizedPlayerPosition) => void;
  eliminatePlayer: (eliminatedPlayerId: string, eliminatorPlayerId: string) => void;
  addPlayer: (player: Player) => void;
  getOrCreatePlayer: (id: string) => any;
}

const Canvas = forwardRef<CanvasRef, CanvasProps>(({ 
  onGameOver, 
  isLocalMode = false, 
  localPlayer = null,
  isZoneMode = false,
  onZoneUpdate,
  onPlayerPositionSync,
  onPlayerInput,
  onPlayerCollision,
  onPlayerElimination,
  getInterpolatedPosition,
  roomId,
  debugMode = false,
  networkPositions,
  onFpsUpdate
}, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { currentRoom, player: currentPlayer } = useGame();
  const [foods, setFoods] = useState<Food[]>([]);
  const [rugs, setRugs] = useState<Rug[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [bots, setBots] = useState<Bot[]>([]);
  const [gameMap, setGameMap] = useState<GeneratedMap | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [cameraZoom, setCameraZoom] = useState<number>(1);
  const [cameraPosition, setCameraPosition] = useState({ x: GAME_WIDTH / 2, y: GAME_HEIGHT / 2 });
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [gameOverCalled, setGameOverCalled] = useState(false);
  const [gameInitialized, setGameInitialized] = useState(false);
  const [gameStartTime, setGameStartTime] = useState<number>(Date.now());
  const [lastTargetPosition, setLastTargetPosition] = useState({ x: 0, y: 0 });
  
  // Mobile-specific state
  const isMobile = useIsMobile();
  const [mobileDirection, setMobileDirection] = useState<{ x: number; y: number } | null>(null);
  
  // Boost power state (solo mode only)
  const [isBoostActive, setIsBoostActive] = useState<boolean>(false);
  const [boostStartTime, setBoostStartTime] = useState<number>(0);
  const [boostCycleEndTime, setBoostCycleEndTime] = useState<number>(0);
  const [isInForcedCycle, setIsInForcedCycle] = useState<boolean>(false);
  const [mousePressed, setMousePressed] = useState<boolean>(false);
  
  // Zone Battle state
  const [safeZone, setSafeZone] = useState<SafeZone | null>(null);
  const [lastDamageTime, setLastDamageTime] = useState<number>(0);
  const [lastPositionSync, setLastPositionSync] = useState<number>(0);

  // NFT Image cache
  const [imageCache, setImageCache] = useState<Map<string, HTMLImageElement>>(new Map());

  // FPS counter for debug mode
  const fpsRef = useRef<{ frames: number; lastTime: number; fps: number }>({
    frames: 0,
    lastTime: performance.now(),
    fps: 0
  });

  const playerRef = useRef<Player | null>(null);
  const gameLoopRef = useRef<number | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastTimestampRef = useRef<number>(0); // Pour calculer le vrai delta

  // Determine if we're in solo mode
  const isSoloMode = isLocalMode && !currentRoom;

  // Calculate target zoom based on player size - improved formula
  const calculateTargetZoom = useCallback((playerSize: number): number => {
    // Improved zoom formula for better scaling with faster movement
    const baseZoom = 1.0;
    const radius = Math.sqrt(playerSize);
    
    // More aggressive zoom scaling for better gameplay at higher speeds
    const sizeInfluence = radius / 15; // Reduced from 20 for more zoom variation
    const targetZoom = baseZoom / (1 + sizeInfluence * 0.9); // Increased from 0.8
    
    // Smoother zoom curve using logarithmic scaling
    const smoothedZoom = baseZoom * Math.pow(0.85, Math.log(playerSize / 15));
    
    // Blend the two approaches for optimal zoom
    const finalZoom = (targetZoom + smoothedZoom) / 2;
    
    // Clamp between min and max zoom
    return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, finalZoom));
  }, []);

  // Expose methods to parent component
  useImperativeHandle(ref, () => ({
    setMobileDirection: (direction: { x: number; y: number } | null) => {
      console.log('Canvas: Setting mobile direction:', direction);
      setMobileDirection(direction);
    },
    updatePlayerPosition: (playerId: string, position: OptimizedPlayerPosition) => {
      console.log('Canvas: Updating player position from sync:', playerId, position);
      setPlayers(prevPlayers => {
        return prevPlayers.map(player => {
          if (player.id === playerId && player.id !== playerRef.current?.id) {
            return {
              ...player,
              x: position.x,
              y: position.y,
              size: position.size
            };
          }
          return player;
        });
      });
    },
    eliminatePlayer: (eliminatedPlayerId: string, eliminatorPlayerId: string) => {
      console.log('Canvas: Eliminating player from sync:', eliminatedPlayerId, 'by', eliminatorPlayerId);
      setPlayers(prevPlayers => {
        return prevPlayers.map(player => {
          if (player.id === eliminatedPlayerId) {
            console.log(`Canvas: Setting player ${eliminatedPlayerId} as dead`);
            return { ...player, isAlive: false };
          }
          if (player.id === eliminatorPlayerId) {
            const eliminatedPlayer = prevPlayers.find(p => p.id === eliminatedPlayerId);
            if (eliminatedPlayer) {
              const newSize = player.size + eliminatedPlayer.size / 2;
              console.log(`Canvas: Player ${eliminatorPlayerId} grew from ${player.size} to ${newSize}`);
              return { ...player, size: newSize };
            }
          }
          return player;
        });
      });
      
      // Check if our player was eliminated
      if (eliminatedPlayerId === playerRef.current?.id && !gameOverCalled) {
        console.log('Canvas: Our player was eliminated, triggering game over');
        setGameOverCalled(true);
        const winner = players.find(p => p.id === eliminatorPlayerId);
        onGameOver(winner || null, 'absorption');
      }
    },
    addPlayer: (newPlayer: Player) => {
      console.log('Canvas: Adding new player from sync:', newPlayer);
      setPlayers(prevPlayers => {
        // Check if player already exists
        const exists = prevPlayers.some(p => p.id === newPlayer.id);
        if (exists) {
          console.log('Canvas: Player already exists, updating position');
          return prevPlayers.map(p => 
            p.id === newPlayer.id 
              ? { ...p, x: newPlayer.x, y: newPlayer.y, size: newPlayer.size, isAlive: true }
              : p
          );
        }
        
        // Add new player
        console.log('Canvas: Adding completely new player');
        return [...prevPlayers, { 
          ...newPlayer, 
          isAlive: true,
          x: newPlayer.x || GAME_WIDTH / 2,
          y: newPlayer.y || GAME_HEIGHT / 2,
          size: newPlayer.size || 15
        }];
      });
    },
    getOrCreatePlayer: (id: string) => {
      // Return a simple mock object that matches what the realtime sync expects
      return {
        setPos: (x: number, y: number) => {
          setPlayers(prevPlayers => {
            return prevPlayers.map(player => {
              if (player.id === id) {
                return { ...player, x, y };
              }
              return player;
            });
          });
        },
        setSize: (size: number) => {
          setPlayers(prevPlayers => {
            return prevPlayers.map(player => {
              if (player.id === id) {
                return { ...player, size };
              }
              return player;
            });
          });
        }
      };
    }
  }));

  // Helper function to preload and cache NFT images
  const preloadImage = (url: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      if (imageCache.has(url)) {
        resolve(imageCache.get(url)!);
        return;
      }

      const img = new Image();
      img.onload = () => {
        setImageCache(prev => new Map(prev.set(url, img)));
        resolve(img);
      };
      img.onerror = reject;
      img.src = url;
    });
  };

  // Initialize bots for solo mode
  const initSoloBots = useCallback(() => {
    if (isSoloMode && playerRef.current) {
      console.log("Canvas: Initializing bots for solo mode");
      const initialBots = BotService.initSoloBots(GAME_WIDTH, GAME_HEIGHT, playerRef.current.id);
      setBots(initialBots);
    }
  }, [isSoloMode]);

  // Update bots in game loop
  const updateSoloBots = useCallback((deltaInSeconds: number) => {
    if (!isSoloMode) return;

    setBots(prevBots => {
      const alivePlayers = players.filter(p => p.isAlive);
      const updatedResult = BotService.updateSoloBots(
        prevBots, 
        foods, 
        alivePlayers,
        GAME_WIDTH, 
        GAME_HEIGHT,
        deltaInSeconds,
        safeZone
      );

      // Handle bot collisions with food and rugs
      const { updatedBots: botsAfterCollisions, updatedFoods, eliminationEvents: collisionEvents } = BotService.checkBotCollisions(
        updatedResult.updatedBots, 
        foods, 
        rugs
      );

      // Process all elimination events
      const allEliminationEvents = [...updatedResult.eliminationEvents, ...collisionEvents];
      allEliminationEvents.forEach(event => {
        if (event.type === 'zone') {
          handleBotZoneDeath(event.eliminatedBot, playerRef.current?.id || '');
        } else if (event.type === 'bot' && event.eliminatorBot) {
          handleBotVsBotElimination(event.eliminatedBot, event.eliminatorBot, playerRef.current?.id || '');
        }
      });

      // Update foods state if any were consumed by bots
      if (updatedFoods.length !== foods.length) {
        setFoods(updatedFoods);
      }

      return botsAfterCollisions;
    });
  }, [isSoloMode, players, foods, rugs]);

  // Initialize safe zone for Zone Battle mode
  const initializeSafeZone = (): SafeZone => {
    const now = Date.now();
    return {
      x: GAME_WIDTH / 2,
      y: GAME_HEIGHT / 2,
      radius: INITIAL_ZONE_RADIUS,
      currentRadius: INITIAL_ZONE_RADIUS,
      maxRadius: INITIAL_ZONE_RADIUS,
      nextShrinkTime: now + 30000,
      shrinkDuration: 10000,
      isActive: true,
      shrinkInterval: ZONE_SHRINK_INTERVAL,
      damagePerSecond: ZONE_DAMAGE_PER_SECOND,
      shrinkPercentage: ZONE_SHRINK_PERCENTAGE
    };
  };

  // Check if player is in safe zone
  const isPlayerInSafeZone = (player: Player, zone: SafeZone): boolean => {
    if (!zone.isActive) return true;
    const dx = player.x - zone.x;
    const dy = player.y - zone.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    return distance <= zone.currentRadius - player.size;
  };

  // Optimized mouse position handler
  const updateMousePosition = useCallback((clientX: number, clientY: number) => {
    if (!canvasRef.current || isMobile) return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    setMousePosition({
      x: clientX - rect.left,
      y: clientY - rect.top
    });
  }, [isMobile]);

  // ENHANCED: Improved player elimination handler with proper sync
  const handlePlayerElimination = useCallback(async (eliminatedPlayer: Player, killerPlayer: Player) => {
    console.log(`Canvas: Player ${eliminatedPlayer.name} was eliminated by ${killerPlayer.name}`);
    
    // Show elimination notification
    EliminationNotificationService.showEliminationNotification({
      eliminatedId: eliminatedPlayer.id,
      eliminatedName: eliminatedPlayer.name,
      eliminatorId: killerPlayer.id,
      eliminatorName: killerPlayer.name,
      type: 'absorption',
      currentPlayerId: playerRef.current?.id
    });
    
    // Update local state immediately
    setPlayers(prevPlayers => {
      return prevPlayers.map(player => {
        if (player.id === eliminatedPlayer.id) {
          return { ...player, isAlive: false };
        }
        if (player.id === killerPlayer.id) {
          return { ...player, size: killerPlayer.size + eliminatedPlayer.size / 2 };
        }
        return player;
      });
    });
    
    // Sync elimination to other players in multiplayer
    if (!isLocalMode) {
      try {
        // Broadcast collision first (for size updates)
        if (onPlayerCollision) {
          await onPlayerCollision(
            eliminatedPlayer.id, 
            killerPlayer.id, 
            eliminatedPlayer.size, 
            killerPlayer.size + eliminatedPlayer.size / 2
          );
        }
        
        // Then broadcast elimination (for isAlive status)
        if (onPlayerElimination) {
          await onPlayerElimination(eliminatedPlayer.id, killerPlayer.id);
        }
        
        console.log('Canvas: Successfully broadcasted elimination');
      } catch (error) {
        console.error('Canvas: Error broadcasting elimination:', error);
      }
    }
    
    // Check if our player was eliminated
    if (eliminatedPlayer.id === playerRef.current?.id && !gameOverCalled) {
      console.log('Canvas: Our player was eliminated, triggering game over');
      setGameOverCalled(true);
      onGameOver(killerPlayer, 'absorption');
    }
  }, [isLocalMode, gameOverCalled, onGameOver, onPlayerCollision, onPlayerElimination]);

  // Optimized food consumption handler
  const handleFoodConsumption = useCallback(async (foodId: string) => {
    if (!isLocalMode && currentRoom && gameState) {
      await GameStateService.consumeFood(currentRoom.id, foodId);
    }
  }, [isLocalMode, currentRoom, gameState]);

  // Game initialization useEffect
  useEffect(() => {
    console.log("Canvas: Game initialization check", { 
      gameInitialized, 
      isLocalMode, 
      localPlayer: !!localPlayer, 
      currentRoom: !!currentRoom,
      currentPlayer: !!currentPlayer,
      isSoloMode
    });
    
    if (gameInitialized) {
      console.log("Canvas: Already initialized, skipping");
      return;
    }
    
    if (gameLoopRef.current) {
      cancelAnimationFrame(gameLoopRef.current);
      gameLoopRef.current = null;
    }
    
    const shouldInitialize = isLocalMode ? !!localPlayer : 
      (currentRoom?.status === 'playing' && !!currentPlayer);
    
    if (!shouldInitialize) {
      console.log("Canvas: Not ready for initialization");
      return;
    }
    
    console.log("Canvas: Initializing synchronized game with bot support");
    
    const initializeGame = async () => {
      let initialPlayers: Player[] = [];
      
      if (isLocalMode && localPlayer) {
        console.log("Canvas: Setting up local player for solo mode:", isSoloMode);
        initialPlayers = [{
          ...localPlayer,
          x: GAME_WIDTH / 2,
          y: GAME_HEIGHT / 2,
          isAlive: true,
          size: 15
        }];
        playerRef.current = initialPlayers[0];
        
        if (localPlayer.nftImageUrl) {
          preloadImage(localPlayer.nftImageUrl).catch(console.error);
        }

        // Generate local map
        const localSeed = MapGenerator.generateSeed("local");
        const localMap = MapGenerator.generateMap(localSeed);
        setGameMap(localMap);
        setFoods(localMap.foods);
        setRugs(localMap.rugs);
        
        // Initialize bots for solo mode
        if (isSoloMode) {
          initSoloBots();
        }
        
      } else if (currentRoom) {
        console.log("Canvas: Initializing multiplayer game with shared seed");
        
        // Get shared game state and seed from database
        const roomGameState = await GameStateService.getGameState(currentRoom.id);
        if (roomGameState) {
          console.log("Canvas: Using shared seed:", roomGameState.mapSeed);
          setGameState(roomGameState);
          
          // Generate map from shared seed - all players use same map
          const sharedMap = MapGenerator.generateMap(roomGameState.mapSeed);
          setGameMap(sharedMap);
          
          // Filter out consumed foods
          const availableFoods = sharedMap.foods.filter(food => 
            !roomGameState.consumedFoods.includes(food.id)
          );
          setFoods(availableFoods);
          setRugs(sharedMap.rugs);
          
          console.log(`Canvas: Shared map loaded with ${availableFoods.length}/${sharedMap.foods.length} foods`);
          
          // Initialize players with synchronized spawn points
          initialPlayers = currentRoom.players.map((p, index) => {
            const spawnPoint = MapGenerator.getSpawnPoint(sharedMap.spawnPoints, index);
            console.log(`Canvas: Player ${p.name} spawning at:`, spawnPoint);
            
            return {
              ...p,
              x: spawnPoint.x,
              y: spawnPoint.y,
              isAlive: true,
              size: 15
            };
          });
          
          const ourPlayer = initialPlayers.find(p => p.id === currentPlayer?.id);
          if (ourPlayer) {
            playerRef.current = ourPlayer;
            console.log("Canvas: Our player initialized:", ourPlayer);
            
            // Sync spawn position to database immediately
            const playerIndex = initialPlayers.findIndex(p => p.id === currentPlayer?.id);
            if (playerIndex >= 0) {
              console.log("Canvas: Syncing spawn position to database");
              await GameStateService.syncPlayerSpawn(currentRoom.id, currentPlayer!.id, playerIndex);
            }
          }
          
          // Preload all players' NFT images
          initialPlayers.forEach(player => {
            if (player.nftImageUrl) {
              preloadImage(player.nftImageUrl).catch(console.error);
            }
          });
        }
      }
      
      setPlayers(initialPlayers);
      console.log("Canvas: Players initialized:", initialPlayers.length);
      
      // Initialize safe zone for Zone Battle mode
      if (isZoneMode) {
        const zone = initializeSafeZone();
        setSafeZone(zone);
        setGameStartTime(Date.now());
        setLastDamageTime(Date.now());
        console.log("Canvas: Zone Battle initialized with safe zone:", zone);
      }
      
      // Center camera on player
      if (playerRef.current) {
        setCameraPosition({ x: playerRef.current.x, y: playerRef.current.y });
        console.log("Canvas: Camera centered on player at:", playerRef.current.x, playerRef.current.y);
      }

      setGameInitialized(true);
      console.log("Canvas: Game initialization completed successfully");
    };

    initializeGame();

    return () => {
      if (gameLoopRef.current) {
        cancelAnimationFrame(gameLoopRef.current);
        gameLoopRef.current = null;
      }
      
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [isLocalMode, localPlayer, currentRoom?.status, currentPlayer, isZoneMode, gameInitialized, roomId, isSoloMode, initSoloBots]);

  // Mouse movement and boost click handlers
  useEffect(() => {
    if (isMobile) return;

    const handleMouseMove = (e: MouseEvent) => {
      updateMousePosition(e.clientX, e.clientY);
    };

    // Boost power handlers for solo mode only
    const handleMouseDown = (e: MouseEvent) => {
      // Block if not solo mode, not left click, or already in forced cycle
      if (!isSoloMode || e.button !== 0 || isInForcedCycle) {
        return;
      }
      
      // Only activate boost if player has enough size (minimum 15)
      if (playerRef.current && playerRef.current.size >= 15) {
        const now = Date.now();
        
        // Start new 1-second cycle and immediately consume 5 size points
        playerRef.current.size = Math.max(10, playerRef.current.size - 5);
        
        setIsBoostActive(true);
        setBoostStartTime(now);
        setBoostCycleEndTime(now + 1000); // 1 second cycle
        setIsInForcedCycle(true);
      }
    };
    
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mousedown', handleMouseDown);
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mousedown', handleMouseDown);
    };
  }, [isMobile, updateMousePosition, isSoloMode]);

  // Enhanced game loop with 50Hz synchronization support
  useEffect(() => {
    if (!gameInitialized || !playerRef.current) {
      console.log("Canvas: Game loop not ready");
      return;
    }
    
    console.log("Canvas: Starting synchronized game loop with 50Hz support");
    
    const gameLoop = (timestamp: number) => {
      const currentTime = Date.now();
      
      // Calculate proper delta time in seconds - optimized for 50Hz
      let deltaInSeconds = 0.016; // Default to 60fps
      if (lastTimestampRef.current > 0) {
        deltaInSeconds = (timestamp - lastTimestampRef.current) / 1000;
        deltaInSeconds = Math.min(deltaInSeconds, 0.033); // Cap at 30fps minimum
      }
      lastTimestampRef.current = timestamp;
      
      // Update bots in solo mode
      if (isSoloMode) {
        updateSoloBots(deltaInSeconds);
      }
      
      // Zone Battle logic
      if (isZoneMode && safeZone) {
        setSafeZone(prevZone => {
          if (!prevZone) return prevZone;
          
          let updatedZone = { ...prevZone };
          
          if (currentTime >= updatedZone.nextShrinkTime) {
            const newRadius = updatedZone.currentRadius * (1 - updatedZone.shrinkPercentage);
            updatedZone = {
              ...updatedZone,
              currentRadius: Math.max(50, newRadius),
              nextShrinkTime: currentTime + updatedZone.shrinkInterval
            };
            console.log("Canvas: Zone shrunk to radius:", updatedZone.currentRadius);
          }
          
          return updatedZone;
        });
      }
      
      setPlayers(prevPlayers => {
        if (prevPlayers.length === 0) return prevPlayers;
        
        const ourPlayerIndex = prevPlayers.findIndex(p => 
          p.id === playerRef.current?.id
        );
        
        if (ourPlayerIndex === -1 || !prevPlayers[ourPlayerIndex].isAlive) {
          return prevPlayers;
        }
        
        const updatedPlayers = [...prevPlayers];
        const me = updatedPlayers[ourPlayerIndex];
        
        // Zone Battle damage logic - MODIFIED: Allow size to reach 0
        if (isZoneMode && safeZone && playerRef.current) {
          const inZone = isPlayerInSafeZone(me, safeZone);
          
          if (!inZone && currentTime - lastDamageTime >= 1000) {
            // Remove minimum size limit - allow size to reach 0
            me.size -= safeZone.damagePerSecond;
            setLastDamageTime(currentTime);
            console.log("Canvas: Player took zone damage, size now:", me.size);
            
            // Check if player died from zone damage
            if (me.size <= 0) {
              me.isAlive = false;
              me.size = 0; // Ensure size doesn't go negative
              console.log("Canvas: Player died from zone damage");
              
              // Show zone death notification
              handleZoneDeath(me);
              
              if (!gameOverCalled) {
                setGameOverCalled(true);
                onGameOver(null, 'zone'); // No winner, death by zone
              }
            }
          }
          
          if (onZoneUpdate) {
            onZoneUpdate(safeZone, inZone);
          }
        }
        
        // Only continue with movement and other logic if player is still alive
        if (!me.isAlive) {
          return updatedPlayers;
        }
        
        // Movement logic with corrected speed system and boost power
        const canvas = canvasRef.current;
        if (canvas) {
          let speedPixelsPerSecond = computeSpeed(me.size); // Using the correct Agar.io speed formula
          
          // Apply boost multiplier in solo mode
          if (isSoloMode && isBoostActive) {
            speedPixelsPerSecond *= 1.5;
          }
          
          // Handle boost cycling logic - Simple: One click = One cycle
          if (isSoloMode && isBoostActive && currentTime >= boostCycleEndTime) {
            setIsBoostActive(false);
            setIsInForcedCycle(false);
          }
          
          if (isMobile && mobileDirection) {
            // Convert speed from px/s to px/frame using real delta
            const frameSpeed = speedPixelsPerSecond * deltaInSeconds;
            me.x += mobileDirection.x * frameSpeed;
            me.y += mobileDirection.y * frameSpeed;
          } else if (!isMobile) {
            const canvasWidth = canvas.width;
            const canvasHeight = canvas.height;
            
            const targetX = cameraPosition.x - (canvasWidth / 2 - mousePosition.x) / cameraZoom;
            const targetY = cameraPosition.y - (canvasHeight / 2 - mousePosition.y) / cameraZoom;
            
            setLastTargetPosition({ x: targetX, y: targetY });
            
            const dx = targetX - me.x;
            const dy = targetY - me.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance > 5) {
              const directionX = dx / distance;
              const directionY = dy / distance;
              // Convert speed from px/s to px/frame using real delta
              const frameSpeed = speedPixelsPerSecond * deltaInSeconds;
              const actualSpeed = Math.min(frameSpeed, distance);
              
              me.x += directionX * actualSpeed;
              me.y += directionY * actualSpeed;
            }
          }
          
          // Game boundaries
          me.x = Math.max(me.size, Math.min(GAME_WIDTH - me.size, me.x));
          me.y = Math.max(me.size, Math.min(GAME_HEIGHT - me.size, me.y));
        }
        
        // ENHANCED: 50Hz input sync for Socket.IO (20ms)
        if (!isLocalMode && onPlayerInput && currentTime - lastPositionSync > 20) {
          setLastPositionSync(currentTime);
          
          // Calculate movement direction based on current movement
          let moveX = 0, moveY = 0;
          
          if (isMobile && mobileDirection) {
            moveX = mobileDirection.x;
            moveY = mobileDirection.y;
          } else if (!isMobile) {
            const dx = lastTargetPosition.x - me.x;
            const dy = lastTargetPosition.y - me.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance > 5) {
              moveX = dx / distance;
              moveY = dy / distance;
            }
          }
          
          // Send input to Socket.IO server
          onPlayerInput(moveX, moveY, isSoloMode && isBoostActive);
        }
        
        // Food collision with sync
        setFoods(prevFoods => {
          const remainingFoods = prevFoods.filter(food => {
            const dx = me.x - food.x;
            const dy = me.y - food.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < me.size) {
              me.size += FOOD_VALUE;
              
              // Sync food consumption
              if (!isLocalMode) {
                handleFoodConsumption(food.id);
              }
              
              console.log(`Food ${food.id} consumed by ${me.name}`);
              return false;
            }
            return true;
          });
          
          // Respawn food only in local mode
          if (isLocalMode && remainingFoods.length < gameMap!.foods.length / 2) {
            const newFoodsCount = gameMap!.foods.length - remainingFoods.length;
            const newFoods = Array(newFoodsCount).fill(0).map((_, index) => ({
              id: `respawn_${Date.now()}_${index}`,
              x: Math.random() * GAME_WIDTH,
              y: Math.random() * GAME_HEIGHT,
              size: FOOD_SIZE
            }));
            return [...remainingFoods, ...newFoods];
          }
          
          return remainingFoods;
        });
        
        // Rug collisions
        setRugs(prevRugs => {
          prevRugs.forEach(rug => {
            const dx = me.x - rug.x;
            const dy = me.y - rug.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < me.size + rug.size) {
              me.size = Math.max(10, me.size - RUG_PENALTY);
              
              if (distance > 0) {
                const pushFactor = Math.min(10, distance * 0.5);
                me.x += (dx / distance) * pushFactor;
                me.y += (dy / distance) * pushFactor;
                
                me.x = Math.max(me.size, Math.min(GAME_WIDTH - me.size, me.x));
                me.y = Math.max(me.size, Math.min(GAME_HEIGHT - me.size, me.y));
              }
            }
          });
          return prevRugs;
        });
        
        // ENHANCED: Player collisions with proper elimination sync
        if (!isLocalMode || isSoloMode) {
          // Check collisions with other players
          for (let i = 0; i < updatedPlayers.length; i++) {
            if (i === ourPlayerIndex || !updatedPlayers[i].isAlive) continue;
            
            const otherPlayer = updatedPlayers[i];
            const dx = me.x - otherPlayer.x;
            const dy = me.y - otherPlayer.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < me.size + otherPlayer.size) {
              if (me.size > otherPlayer.size * 1.2) {
                // We eliminate the other player
                console.log(`Canvas: ${me.name} eliminates ${otherPlayer.name}`);
                handlePlayerElimination(otherPlayer, me);
              } else if (otherPlayer.size > me.size * 1.2) {
                // Other player eliminates us
                console.log(`Canvas: ${otherPlayer.name} eliminates ${me.name}`);
                handlePlayerElimination(me, otherPlayer);
              } else {
                // Push apart - no elimination
                const angle = Math.atan2(dy, dx);
                const pushDistance = Math.min(5, distance * 0.3);
                me.x += Math.cos(angle) * pushDistance;
                me.y += Math.sin(angle) * pushDistance;
                
                me.x = Math.max(me.size, Math.min(GAME_WIDTH - me.size, me.x));
                me.y = Math.max(me.size, Math.min(GAME_HEIGHT - me.size, me.y));
              }
            }
          }

          // Check collisions with bots in solo mode
          if (isSoloMode) {
            setBots(prevBots => {
              return prevBots.map(bot => {
                if (!bot.isAlive) return bot;
                
                const dx = me.x - bot.x;
                const dy = me.y - bot.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance < me.size + bot.size) {
                  if (me.size > bot.size * 1.2) {
                    bot.isAlive = false;
                    me.size += bot.size / 2;
                    handleBotElimination(me, bot, true);
                  } else if (bot.size > me.size * 1.2) {
                    me.isAlive = false;
                    handleBotElimination(me, bot, false);
                    if (!gameOverCalled) {
                      setGameOverCalled(true);
                      onGameOver(bot);
                    }
                  } else {
                    // Push apart
                    const angle = Math.atan2(dy, dx);
                    const pushDistance = Math.min(5, distance * 0.3);
                    me.x += Math.cos(angle) * pushDistance;
                    me.y += Math.sin(angle) * pushDistance;
                    
                    me.x = Math.max(me.size, Math.min(GAME_WIDTH - me.size, me.x));
                    me.y = Math.max(me.size, Math.min(GAME_HEIGHT - me.size, me.y));
                  }
                }
                
                return bot;
              });
            });
          }
        }
        
        // Update camera position to follow player
        setCameraPosition(prev => ({
          x: prev.x + (me.x - prev.x) * 0.1,
          y: prev.y + (me.y - prev.y) * 0.1
        }));
        
        // Update zoom based on player size with smooth transition
        const targetZoom = calculateTargetZoom(me.size);
        setCameraZoom(prev => {
          return prev + (targetZoom - prev) * ZOOM_SMOOTH_FACTOR;
        });
        
        return updatedPlayers;
      });
      
      gameLoopRef.current = requestAnimationFrame(gameLoop);
    };
    
    gameLoopRef.current = requestAnimationFrame(gameLoop);
    
    return () => {
      if (gameLoopRef.current) {
        cancelAnimationFrame(gameLoopRef.current);
        gameLoopRef.current = null;
      }
    };
  }, [gameInitialized, cameraZoom, cameraPosition, mousePosition, isLocalMode, isZoneMode, safeZone, lastDamageTime, onZoneUpdate, isMobile, mobileDirection, handlePlayerElimination, onPlayerInput, lastPositionSync, handleFoodConsumption, isSoloMode, updateSoloBots, gameOverCalled, onGameOver, calculateTargetZoom, lastTargetPosition]);

  // Optimized rendering with bot support
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
    };
    
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    
    // Optimized drawing with bots included
    const renderCanvas = () => {
      const context = canvas.getContext('2d');
      if (!context) return;
      
      // FPS counter for debug mode
      fpsRef.current.frames++;
      const now = performance.now();
      if (now - fpsRef.current.lastTime >= 1000) {
        fpsRef.current.fps = fpsRef.current.frames;
        fpsRef.current.frames = 0;
        fpsRef.current.lastTime = now;
        onFpsUpdate?.(fpsRef.current.fps);
      }
      
      // Clear canvas with black background
      context.fillStyle = "#000000";
      context.fillRect(0, 0, canvas.width, canvas.height);
      
      // Transform for camera position and zoom
      context.save();
      context.translate(canvas.width / 2, canvas.height / 2);
      context.scale(cameraZoom, cameraZoom);
      context.translate(-cameraPosition.x, -cameraPosition.y);
      
      // Draw game bounds
      context.beginPath();
      context.strokeStyle = '#444';
      context.lineWidth = 4 / cameraZoom;
      context.strokeRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
      
      // Draw grid
      context.beginPath();
      context.strokeStyle = GRID_COLOR;
      context.lineWidth = 1 / cameraZoom;
      
      for (let x = 0; x <= GAME_WIDTH; x += GRID_SIZE) {
        context.moveTo(x, 0);
        context.lineTo(x, GAME_HEIGHT);
      }
      
      for (let y = 0; y <= GAME_HEIGHT; y += GRID_SIZE) {
        context.moveTo(0, y);
        context.lineTo(GAME_WIDTH, y);
      }
      
      context.stroke();
      
      // Zone rendering
      if (isZoneMode && safeZone && safeZone.isActive) {
        context.beginPath();
        context.strokeStyle = '#22c55e';
        context.lineWidth = 3 / cameraZoom;
        context.arc(safeZone.x, safeZone.y, safeZone.currentRadius, 0, Math.PI * 2);
        context.stroke();
        
        context.beginPath();
        context.strokeStyle = '#ef4444';
        context.lineWidth = 6 / cameraZoom;
        context.setLineDash([10 / cameraZoom, 10 / cameraZoom]);
        context.arc(safeZone.x, safeZone.y, safeZone.currentRadius + 20, 0, Math.PI * 2);
        context.stroke();
        context.setLineDash([]);
        
        context.globalCompositeOperation = 'multiply';
        context.fillStyle = 'rgba(239, 68, 68, 0.1)';
        context.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
        
        context.globalCompositeOperation = 'destination-out';
        context.beginPath();
        context.arc(safeZone.x, safeZone.y, safeZone.currentRadius, 0, Math.PI * 2);
        context.fill();
        
        context.globalCompositeOperation = 'source-over';
      }
      
      // Draw foods
      foods.forEach(food => {
        context.beginPath();
        context.fillStyle = '#2ecc71';
        context.arc(food.x, food.y, food.size, 0, Math.PI * 2);
        context.fill();
      });
      
      // Draw rugs
      rugs.forEach(rug => {
        context.beginPath();
        context.fillStyle = '#8e44ad';
        context.arc(rug.x, rug.y, rug.size, 0, Math.PI * 2);
        context.fill();
      });
      
      // Draw players - ENHANCED: Show dead players as semi-transparent
      players.forEach(player => {
        context.save();
        
        // Semi-transparent for dead players
        if (!player.isAlive) {
          context.globalAlpha = 0.3;
        }
        
        const hasNftImage = player.nftImageUrl && imageCache.has(player.nftImageUrl);
        
        if (hasNftImage) {
          const img = imageCache.get(player.nftImageUrl!);
          if (img) {
            context.beginPath();
            context.arc(player.x, player.y, player.size, 0, Math.PI * 2);
            context.clip();
            
            const imageSize = player.size * 2;
            context.drawImage(
              img,
              player.x - player.size,
              player.y - player.size,
              imageSize,
              imageSize
            );
            
            context.restore();
            context.save();
            
            // Semi-transparent for dead players
            if (!player.isAlive) {
              context.globalAlpha = 0.3;
            }
            
            context.beginPath();
            context.strokeStyle = player.isAlive ? '#ffffff' : '#ff0000';
            context.lineWidth = 2 / cameraZoom;
            context.arc(player.x, player.y, player.size, 0, Math.PI * 2);
            context.stroke();
          }
        } else {
          context.beginPath();
          context.fillStyle = player.isAlive ? `#${getColorHex(player.color)}` : '#666666';
          context.arc(player.x, player.y, player.size, 0, Math.PI * 2);
          context.fill();
          
          // Add boost glow effect if this is our player and boost is active
          if (isSoloMode && player.id === playerRef.current?.id && isBoostActive) {
            context.beginPath();
            context.strokeStyle = '#ffff00';
            context.shadowColor = '#ffff00';
            context.shadowBlur = 20 / cameraZoom;
            context.lineWidth = 3 / cameraZoom;
            context.arc(player.x, player.y, player.size + 5, 0, Math.PI * 2);
            context.stroke();
            context.shadowBlur = 0;
          }
        }
        
        context.font = `${14 / cameraZoom}px Arial`;
        context.fillStyle = player.isAlive ? '#fff' : '#999';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.strokeStyle = '#000';
        context.lineWidth = 3 / cameraZoom;
        const playerLabel = `${player.name} (${Math.round(player.size)})${!player.isAlive ? ' [DEAD]' : ''}`;
        context.strokeText(playerLabel, player.x, player.y);
        context.fillText(playerLabel, player.x, player.y);
        
        // DEBUG MODE: Display player ID above the ball
        if (debugMode) {
          context.font = `${10 / cameraZoom}px monospace`;
          context.fillStyle = '#00ff00';
          context.textAlign = 'center';
          const shortId = player.id.substring(0, 8);
          context.strokeStyle = '#000';
          context.lineWidth = 2 / cameraZoom;
          context.strokeText(shortId, player.x, player.y - player.size - 20);
          context.fillText(shortId, player.x, player.y - player.size - 20);
          
          // DEBUG MODE: Draw network ghost for enemy players (ghosting visualization)
          const networkPos = networkPositions?.get(player.id);
          if (networkPos && player.id !== playerRef.current?.id) {
            // Draw red dashed circle at network position (target)
            context.beginPath();
            context.strokeStyle = '#ff0000';
            context.lineWidth = 2 / cameraZoom;
            context.setLineDash([5 / cameraZoom, 5 / cameraZoom]);
            context.arc(networkPos.x, networkPos.y, networkPos.size, 0, Math.PI * 2);
            context.stroke();
            context.setLineDash([]);
            
            // Draw line from network position to interpolated position
            context.beginPath();
            context.strokeStyle = '#ff0000';
            context.lineWidth = 1 / cameraZoom;
            context.moveTo(networkPos.x, networkPos.y);
            context.lineTo(player.x, player.y);
            context.stroke();
            
            // Display distance offset in pixels
            const distance = Math.sqrt(
              Math.pow(player.x - networkPos.x, 2) + 
              Math.pow(player.y - networkPos.y, 2)
            );
            if (distance > 1) {
              context.fillStyle = '#ff6666';
              context.font = `${8 / cameraZoom}px monospace`;
              context.fillText(
                `${distance.toFixed(1)}px`, 
                (player.x + networkPos.x) / 2, 
                (player.y + networkPos.y) / 2 - 10
              );
            }
          }
        }
        
        context.restore();
      });
      
      // Draw bots in solo mode
      if (isSoloMode) {
        bots.forEach(bot => {
          if (!bot.isAlive) return;
          
          context.save();
          
          // Draw bot with a slightly different style (glowing border)
          context.beginPath();
          context.fillStyle = `#${getColorHex(bot.color)}`;
          context.arc(bot.x, bot.y, bot.size, 0, Math.PI * 2);
          context.fill();
          
          // Add bot glow effect
          context.beginPath();
          context.strokeStyle = '#ffff00';
          context.lineWidth = 2 / cameraZoom;
          context.arc(bot.x, bot.y, bot.size, 0, Math.PI * 2);
          context.stroke();
          
          // Bot name with [BOT] prefix
          context.font = `${12 / cameraZoom}px Arial`;
          context.fillStyle = '#fff';
          context.textAlign = 'center';
          context.textBaseline = 'middle';
          context.strokeStyle = '#000';
          context.lineWidth = 2 / cameraZoom;
          const botLabel = `[BOT] ${bot.name} (${Math.round(bot.size)})`;
          context.strokeText(botLabel, bot.x, bot.y);
          context.fillText(botLabel, bot.x, bot.y);
          
          context.restore();
        });
      }
      
      context.restore();
      
      animationFrameRef.current = requestAnimationFrame(renderCanvas);
    };
    
    animationFrameRef.current = requestAnimationFrame(renderCanvas);
    
    return () => {
      window.removeEventListener('resize', resizeCanvas);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [players, bots, foods, rugs, cameraPosition, cameraZoom, isZoneMode, safeZone, imageCache, isSoloMode, debugMode, networkPositions, onFpsUpdate]);

  const getColorHex = (color: string): string => {
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
  };

  return (
    <canvas 
      ref={canvasRef} 
      className="w-full h-full bg-black"
      style={{ touchAction: 'none' }}
    />
  );
});

Canvas.displayName = 'Canvas';

export default Canvas;
