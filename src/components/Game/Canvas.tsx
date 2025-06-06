import React, { useRef, useEffect, useState, useImperativeHandle, forwardRef, useCallback, useMemo } from "react";
import { useGame } from "@/context/GameContext";
import { Food, Rug, Player, SafeZone } from "@/types/game";
import { useIsMobile } from "@/hooks/use-mobile";
import { OptimizedPlayerPosition } from "@/services/realtime/optimizedGameSync";
import { MapGenerator, GeneratedMap } from "@/services/game/mapGenerator";
import { GameStateService, GameState } from "@/services/game/gameStateService";
import { BotService, Bot } from "@/services/game/botService";

// Constants
const GAME_WIDTH = 3000;
const GAME_HEIGHT = 3000;
const FOOD_SIZE = 5;
const RUG_SIZE = 40;
const FOOD_VALUE = 1;
const RUG_PENALTY = 5;
const GRID_SIZE = 150;
const GRID_COLOR = "#333333";

// Speed configuration constants
const BASE_SPEED = 3.5;
const MIN_SPEED_RATIO = 0.25;
const SPEED_REDUCTION_FACTOR = 0.025;

// Zone Battle constants
const ZONE_SHRINK_INTERVAL = 120000;
const ZONE_DAMAGE_PER_SECOND = 3;
const ZONE_SHRINK_PERCENTAGE = 0.2;
const INITIAL_ZONE_RADIUS = 1400;

interface CanvasProps {
  onGameOver: (winner: Player | null, eliminationType?: 'absorption' | 'zone' | 'timeout') => void;
  isLocalMode?: boolean;
  localPlayer?: Player | null;
  isZoneMode?: boolean;
  onZoneUpdate?: (zone: SafeZone, isPlayerInZone: boolean) => void;
  onPlayerPositionSync?: (position: { x: number; y: number; size: number }) => void;
  onPlayerCollision?: (eliminatedPlayerId: string, eliminatorPlayerId: string, eliminatedSize: number, eliminatorNewSize: number) => Promise<void>;
  roomId?: string;
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
  onPlayerCollision,
  roomId
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
  
  // Zone Battle state
  const [safeZone, setSafeZone] = useState<SafeZone | null>(null);
  const [lastDamageTime, setLastDamageTime] = useState<number>(0);
  const [lastPositionSync, setLastPositionSync] = useState<number>(0);

  // NFT Image cache
  const [imageCache, setImageCache] = useState<Map<string, HTMLImageElement>>(new Map());

  const playerRef = useRef<Player | null>(null);
  const gameLoopRef = useRef<number | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Determine if we're in solo mode
  const isSoloMode = isLocalMode && !currentRoom;

  // Memoized calculations for performance
  const calculateSpeed = useMemo(() => (size: number): number => {
    const sizeAboveBase = Math.max(0, size - 15);
    const speedReduction = sizeAboveBase * SPEED_REDUCTION_FACTOR;
    const speedFactor = Math.max(MIN_SPEED_RATIO, 1 - speedReduction);
    return BASE_SPEED * speedFactor;
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
            return { ...player, isAlive: false };
          }
          if (player.id === eliminatorPlayerId) {
            const eliminatedPlayer = prevPlayers.find(p => p.id === eliminatedPlayerId);
            if (eliminatedPlayer) {
              return { ...player, size: player.size + eliminatedPlayer.size / 2 };
            }
          }
          return player;
        });
      });
      
      // Check if our player was eliminated
      if (eliminatedPlayerId === playerRef.current?.id && !gameOverCalled) {
        setGameOverCalled(true);
        const winner = players.find(p => p.id === eliminatorPlayerId);
        onGameOver(winner || null);
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
  const updateSoloBots = useCallback((delta: number) => {
    if (!isSoloMode) return;

    setBots(prevBots => {
      const alivePlayers = players.filter(p => p.isAlive);
      const updatedBots = BotService.updateSoloBots(
        prevBots, 
        foods, 
        alivePlayers,
        GAME_WIDTH, 
        GAME_HEIGHT,
        delta
      );

      // Handle bot collisions with food and rugs
      const { updatedBots: botsAfterCollisions, updatedFoods } = BotService.checkBotCollisions(
        updatedBots, 
        foods, 
        rugs
      );

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

  // Optimized player elimination handler
  const handlePlayerElimination = useCallback((eliminatedPlayer: Player, killerPlayer: Player) => {
    console.log(`Player ${eliminatedPlayer.name} was eliminated by ${killerPlayer.name}`);
    
    if (!isLocalMode && onPlayerCollision) {
      onPlayerCollision(eliminatedPlayer.id, killerPlayer.id, eliminatedPlayer.size, killerPlayer.size + eliminatedPlayer.size / 2);
    }
    
    if (!isLocalMode && !gameOverCalled) {
      setGameOverCalled(true);
      onGameOver(killerPlayer);
    }
  }, [isLocalMode, gameOverCalled, onGameOver, onPlayerCollision]);

  // Optimized food consumption handler
  const handleFoodConsumption = useCallback(async (foodId: string) => {
    if (!isLocalMode && currentRoom && gameState) {
      await GameStateService.consumeFood(currentRoom.id, foodId);
    }
  }, [isLocalMode, currentRoom, gameState]);

  // FIXED: Enhanced game initialization with bot support
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
        
        // FIXED: Get shared game state and seed from database
        const roomGameState = await GameStateService.getGameState(currentRoom.id);
        if (roomGameState) {
          console.log("Canvas: Using shared seed:", roomGameState.mapSeed);
          setGameState(roomGameState);
          
          // FIXED: Generate map from shared seed - all players use same map
          const sharedMap = MapGenerator.generateMap(roomGameState.mapSeed);
          setGameMap(sharedMap);
          
          // Filter out consumed foods
          const availableFoods = sharedMap.foods.filter(food => 
            !roomGameState.consumedFoods.includes(food.id)
          );
          setFoods(availableFoods);
          setRugs(sharedMap.rugs);
          
          console.log(`Canvas: Shared map loaded with ${availableFoods.length}/${sharedMap.foods.length} foods`);
          
          // FIXED: Initialize players with synchronized spawn points
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
            
            // FIXED: Sync spawn position to database immediately
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

  // Mouse movement handler
  useEffect(() => {
    if (isMobile) return;

    const handleMouseMove = (e: MouseEvent) => {
      updateMousePosition(e.clientX, e.clientY);
    };
    
    window.addEventListener('mousemove', handleMouseMove);
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, [isMobile, updateMousePosition]);

  // FIXED: Enhanced game loop with bot support
  useEffect(() => {
    if (!gameInitialized || !playerRef.current) {
      console.log("Canvas: Game loop not ready");
      return;
    }
    
    console.log("Canvas: Starting synchronized game loop with bot support");
    
    const gameLoop = (timestamp: number) => {
      const currentTime = Date.now();
      const delta = timestamp / 1000; // Convert to seconds for bot updates
      
      // Update bots in solo mode
      if (isSoloMode) {
        updateSoloBots(delta);
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
        
        // Zone Battle damage logic
        if (isZoneMode && safeZone && playerRef.current) {
          const inZone = isPlayerInSafeZone(me, safeZone);
          
          if (!inZone && currentTime - lastDamageTime >= 1000) {
            me.size = Math.max(10, me.size - safeZone.damagePerSecond);
            setLastDamageTime(currentTime);
            console.log("Canvas: Player took zone damage, size now:", me.size);
          }
          
          if (onZoneUpdate) {
            onZoneUpdate(safeZone, inZone);
          }
        }
        
        // Movement logic
        const canvas = canvasRef.current;
        if (canvas) {
          const maxSpeed = calculateSpeed(me.size);
          
          if (isMobile && mobileDirection) {
            me.x += mobileDirection.x * maxSpeed;
            me.y += mobileDirection.y * maxSpeed;
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
              const actualSpeed = Math.min(maxSpeed, distance);
              
              me.x += directionX * actualSpeed;
              me.y += directionY * actualSpeed;
            }
          }
          
          // Game boundaries
          me.x = Math.max(me.size, Math.min(GAME_WIDTH - me.size, me.x));
          me.y = Math.max(me.size, Math.min(GAME_HEIGHT - me.size, me.y));
        }
        
        // FIXED: Faster position sync for better multiplayer experience (100ms)
        if (!isLocalMode && onPlayerPositionSync && currentTime - lastPositionSync > 100) {
          setLastPositionSync(currentTime);
          onPlayerPositionSync({
            x: me.x,
            y: me.y,
            size: me.size
          });
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
        
        // Player collisions (including bot collisions in solo mode)
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
                otherPlayer.isAlive = false;
                me.size += otherPlayer.size / 2;
                if (!isLocalMode) {
                  handlePlayerElimination(otherPlayer, me);
                }
              } else if (otherPlayer.size > me.size * 1.2) {
                me.isAlive = false;
                if (!isLocalMode) {
                  handlePlayerElimination(me, otherPlayer);
                }
              } else {
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
                    console.log(`Player eliminated bot ${bot.name}`);
                  } else if (bot.size > me.size * 1.2) {
                    me.isAlive = false;
                    console.log(`Bot ${bot.name} eliminated player`);
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
        
        // Update camera
        setCameraPosition(prev => ({
          x: prev.x + (me.x - prev.x) * 0.1,
          y: prev.y + (me.y - prev.y) * 0.1
        }));
        
        // Update zoom
        const maxSize = 50;
        const effectiveSize = Math.min(me.size, maxSize);
        setCameraZoom(prev => {
          const targetZoom = Math.max(0.5, Math.min(1.5, 20 / Math.sqrt(effectiveSize)));
          return prev + (targetZoom - prev) * 0.05;
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
  }, [gameInitialized, cameraZoom, cameraPosition, mousePosition, isLocalMode, isZoneMode, safeZone, lastDamageTime, onZoneUpdate, isMobile, mobileDirection, handlePlayerElimination, onPlayerPositionSync, lastPositionSync, handleFoodConsumption, calculateSpeed, isSoloMode, updateSoloBots, gameOverCalled, onGameOver]);

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
      
      // Draw players
      players.forEach(player => {
        if (!player.isAlive) return;
        
        context.save();
        
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
            context.beginPath();
            context.strokeStyle = '#ffffff';
            context.lineWidth = 2 / cameraZoom;
            context.arc(player.x, player.y, player.size, 0, Math.PI * 2);
            context.stroke();
          }
        } else {
          context.beginPath();
          context.fillStyle = `#${getColorHex(player.color)}`;
          context.arc(player.x, player.y, player.size, 0, Math.PI * 2);
          context.fill();
        }
        
        context.font = `${14 / cameraZoom}px Arial`;
        context.fillStyle = '#fff';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.strokeStyle = '#000';
        context.lineWidth = 3 / cameraZoom;
        context.strokeText(`${player.name} (${Math.round(player.size)})`, player.x, player.y);
        context.fillText(`${player.name} (${Math.round(player.size)})`, player.x, player.y);
        
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
  }, [players, bots, foods, rugs, cameraPosition, cameraZoom, isZoneMode, safeZone, imageCache, isSoloMode]);

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
