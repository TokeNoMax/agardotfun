import React, { useRef, useEffect, useState, useImperativeHandle, forwardRef, useCallback } from "react";
import { useGame } from "@/context/GameContext";
import { Food, Rug, Player, SafeZone } from "@/types/game";
import { useIsMobile } from "@/hooks/use-mobile";
import { PlayerPosition } from "@/services/realtime/gameSync";

// Constants - Augmenté la taille du jeu et ajouté des constantes pour la grille
const GAME_WIDTH = 3000;
const GAME_HEIGHT = 3000;
const FOOD_COUNT = 150; // Augmenté pour la plus grande carte
const RUG_COUNT = 10; // Augmenté pour la plus grande carte
const FOOD_SIZE = 5;
const RUG_SIZE = 40;
const FOOD_VALUE = 1;
const RUG_PENALTY = 5;
const GRID_SIZE = 150;
const GRID_COLOR = "#333333";

// Speed configuration constants for better gameplay balance
const BASE_SPEED = 3.5; // Base speed for small blobs
const MIN_SPEED_RATIO = 0.25; // Minimum speed ratio (25% of base speed for very large blobs)
const SPEED_REDUCTION_FACTOR = 0.025; // How much speed decreases per size unit

// Zone Battle constants
const ZONE_SHRINK_INTERVAL = 120000; // 2 minutes in milliseconds
const ZONE_DAMAGE_PER_SECOND = 3;
const ZONE_SHRINK_PERCENTAGE = 0.2; // 20% reduction
const INITIAL_ZONE_RADIUS = 1400;

interface CanvasProps {
  onGameOver: (winner: Player | null, eliminationType?: 'absorption' | 'zone' | 'timeout') => void;
  isLocalMode?: boolean;
  localPlayer?: Player | null;
  isZoneMode?: boolean;
  onZoneUpdate?: (zone: SafeZone, isPlayerInZone: boolean) => void;
  onPlayerPositionSync?: (position: PlayerPosition) => Promise<void>;
  onPlayerCollision?: (eliminatedPlayerId: string, eliminatorPlayerId: string, eliminatedSize: number, eliminatorNewSize: number) => Promise<void>;
}

export interface CanvasRef {
  setMobileDirection: (direction: { x: number; y: number } | null) => void;
  updatePlayerPosition: (playerId: string, position: PlayerPosition) => void;
  eliminatePlayer: (eliminatedPlayerId: string, eliminatorPlayerId: string) => void;
}

const Canvas = forwardRef<CanvasRef, CanvasProps>(({ 
  onGameOver, 
  isLocalMode = false, 
  localPlayer = null,
  isZoneMode = false,
  onZoneUpdate,
  onPlayerPositionSync,
  onPlayerCollision
}, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { currentRoom, player: currentPlayer } = useGame();
  const [foods, setFoods] = useState<Food[]>([]);
  const [rugs, setRugs] = useState<Rug[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [cameraZoom, setCameraZoom] = useState<number>(1);
  const [cameraPosition, setCameraPosition] = useState({ x: GAME_WIDTH / 2, y: GAME_HEIGHT / 2 });
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [gameOverCalled, setGameOverCalled] = useState(false);
  const [lastTargetPosition, setLastTargetPosition] = useState({ x: 0, y: 0 });
  const [gameInitialized, setGameInitialized] = useState(false);
  
  // Mobile-specific state
  const isMobile = useIsMobile();
  const [mobileDirection, setMobileDirection] = useState<{ x: number; y: number } | null>(null);
  
  // Zone Battle state
  const [safeZone, setSafeZone] = useState<SafeZone | null>(null);
  const [gameStartTime, setGameStartTime] = useState<number>(0);
  const [lastDamageTime, setLastDamageTime] = useState<number>(0);
  const [lastPositionSync, setLastPositionSync] = useState<number>(0);

  // NFT Image cache for performance
  const [imageCache, setImageCache] = useState<Map<string, HTMLImageElement>>(new Map());

  const playerRef = useRef<Player | null>(null);
  const gameLoopRef = useRef<number | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Expose methods to parent component for real-time sync
  useImperativeHandle(ref, () => ({
    setMobileDirection: (direction: { x: number; y: number } | null) => {
      console.log('Canvas: Setting mobile direction:', direction);
      setMobileDirection(direction);
    },
    updatePlayerPosition: (playerId: string, position: PlayerPosition) => {
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

  // Helper function to calculate speed based on blob size
  const calculateSpeed = (size: number): number => {
    // Progressive speed reduction: larger blobs are significantly slower
    const sizeAboveBase = Math.max(0, size - 15); // Start reduction after size 15
    const speedReduction = sizeAboveBase * SPEED_REDUCTION_FACTOR;
    const speedFactor = Math.max(MIN_SPEED_RATIO, 1 - speedReduction);
    return BASE_SPEED * speedFactor;
  };

  // Initialize safe zone for Zone Battle mode
  const initializeSafeZone = (): SafeZone => {
    const now = Date.now();
    return {
      x: GAME_WIDTH / 2,
      y: GAME_HEIGHT / 2,
      currentRadius: INITIAL_ZONE_RADIUS,
      maxRadius: INITIAL_ZONE_RADIUS,
      nextShrinkTime: now + 30000, // 30 seconds grace period
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

  // Mouse position handler (PC only)
  const updateMousePosition = (clientX: number, clientY: number) => {
    if (!canvasRef.current || isMobile) return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    setMousePosition({
      x: clientX - rect.left,
      y: clientY - rect.top
    });
  };

  // NEW: Handle player elimination with immediate game over
  const handlePlayerElimination = useCallback((eliminatedPlayer: Player, killerPlayer: Player) => {
    console.log(`Player ${eliminatedPlayer.name} was eliminated by ${killerPlayer.name}`);
    
    // In multiplayer, sync the collision
    if (!isLocalMode && onPlayerCollision) {
      onPlayerCollision(eliminatedPlayer.id, killerPlayer.id, eliminatedPlayer.size, killerPlayer.size + eliminatedPlayer.size / 2);
    }
    
    if (!isLocalMode && !gameOverCalled) {
      setGameOverCalled(true);
      // In multiplayer, game ends immediately when someone is eaten
      onGameOver(killerPlayer);
    }
  }, [isLocalMode, gameOverCalled, onGameOver, onPlayerCollision]);

  // SEPARATED: Game initialization effect (runs only once)
  useEffect(() => {
    console.log("Canvas: Game initialization check", { 
      gameInitialized, 
      isLocalMode, 
      localPlayer: !!localPlayer, 
      currentRoom: !!currentRoom,
      currentPlayer: !!currentPlayer 
    });
    
    if (gameInitialized) {
      console.log("Canvas: Already initialized, skipping");
      return;
    }
    
    // Clear any existing game loops
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
    
    console.log("Canvas: Initializing game for the first time");
    
    let initialPlayers: Player[] = [];
    
    if (isLocalMode && localPlayer) {
      console.log("Canvas: Setting up local player for Zone Battle:", isZoneMode);
      initialPlayers = [{
        ...localPlayer,
        x: GAME_WIDTH / 2,
        y: GAME_HEIGHT / 2,
        isAlive: true,
        size: 15
      }];
      playerRef.current = initialPlayers[0];
      
      // Preload NFT image if available
      if (localPlayer.nftImageUrl) {
        preloadImage(localPlayer.nftImageUrl).catch(console.error);
      }
    } else if (currentRoom) {
      initialPlayers = currentRoom.players.map(p => ({
        ...p,
        x: Math.random() * (GAME_WIDTH - 100) + 50,
        y: Math.random() * (GAME_HEIGHT - 100) + 50,
        isAlive: true,
        size: 15
      }));
      
      const ourPlayer = initialPlayers.find(p => p.id === currentPlayer?.id);
      if (ourPlayer) {
        playerRef.current = ourPlayer;
      }
      
      // Preload all players' NFT images
      initialPlayers.forEach(player => {
        if (player.nftImageUrl) {
          preloadImage(player.nftImageUrl).catch(console.error);
        }
      });
    }
    
    setPlayers(initialPlayers);
    
    // Initialize safe zone for Zone Battle mode
    if (isZoneMode) {
      const zone = initializeSafeZone();
      setSafeZone(zone);
      setGameStartTime(Date.now());
      setLastDamageTime(Date.now());
      console.log("Canvas: Zone Battle initialized with safe zone:", zone);
    }
    
    // Generate foods
    const initialFoods = Array(FOOD_COUNT).fill(0).map(() => ({
      id: Math.random().toString(36).substring(2, 9),
      x: Math.random() * GAME_WIDTH,
      y: Math.random() * GAME_HEIGHT,
      size: FOOD_SIZE
    }));
    setFoods(initialFoods);
    
    // Generate rugs
    const initialRugs = Array(RUG_COUNT).fill(0).map(() => ({
      id: Math.random().toString(36).substring(2, 9),
      x: Math.random() * GAME_WIDTH,
      y: Math.random() * GAME_HEIGHT,
      size: RUG_SIZE
    }));
    setRugs(initialRugs);
    
    // Center camera on player
    if (playerRef.current) {
      setCameraPosition({ x: playerRef.current.x, y: playerRef.current.y });
    }

    setGameInitialized(true);
    console.log("Canvas: Game initialization completed");

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
  }, [isLocalMode, localPlayer, currentRoom?.status, currentPlayer, isZoneMode, gameInitialized]);

  // SEPARATED: Room updates effect (for multiplayer sync without reset)
  useEffect(() => {
    if (!gameInitialized || isLocalMode || !currentRoom) return;
    
    console.log("Canvas: Syncing with room updates without reset");
    
    // Update existing players without full reset
    setPlayers(prevPlayers => {
      const updatedPlayers = [...prevPlayers];
      
      // Handle new players joining
      currentRoom.players.forEach(roomPlayer => {
        const existingIndex = updatedPlayers.findIndex(p => p.id === roomPlayer.id);
        if (existingIndex === -1) {
          // New player joined - add them without reset
          const newPlayer = {
            ...roomPlayer,
            x: Math.random() * (GAME_WIDTH - 100) + 50,
            y: Math.random() * (GAME_HEIGHT - 100) + 50,
            isAlive: true,
            size: 15
          };
          updatedPlayers.push(newPlayer);
          console.log("Canvas: New player joined:", newPlayer.name);
        }
      });
      
      return updatedPlayers;
    });
  }, [currentRoom?.players, gameInitialized, isLocalMode]);

  // Mouse movement handler (PC only)
  useEffect(() => {
    if (isMobile) return;

    const handleMouseMove = (e: MouseEvent) => {
      updateMousePosition(e.clientX, e.clientY);
    };
    
    window.addEventListener('mousemove', handleMouseMove);
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, [isMobile]);

  // Game loop - optimized with real-time sync
  useEffect(() => {
    if (!gameInitialized || !playerRef.current) {
      console.log("Canvas: Game loop not ready");
      return;
    }
    
    console.log("Canvas: Starting game loop");
    
    const gameLoop = (timestamp: number) => {
      const currentTime = Date.now();
      
      // Zone Battle logic
      if (isZoneMode && safeZone) {
        setSafeZone(prevZone => {
          if (!prevZone) return prevZone;
          
          let updatedZone = { ...prevZone };
          
          // Check if it's time to shrink the zone
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
        
        // Find our player index
        const ourPlayerIndex = prevPlayers.findIndex(p => 
          p.id === playerRef.current?.id
        );
        
        if (ourPlayerIndex === -1 || !prevPlayers[ourPlayerIndex].isAlive) {
          return prevPlayers;
        }
        
        const updatedPlayers = [...prevPlayers];
        const me = updatedPlayers[ourPlayerIndex];
        
        // Zone Battle: Check if player is outside safe zone and apply damage
        if (isZoneMode && safeZone && playerRef.current) {
          const inZone = isPlayerInSafeZone(me, safeZone);
          
          if (!inZone && currentTime - lastDamageTime >= 1000) {
            me.size = Math.max(10, me.size - safeZone.damagePerSecond);
            setLastDamageTime(currentTime);
            console.log("Canvas: Player took zone damage, size now:", me.size);
          }
          
          // Update zone info for UI
          if (onZoneUpdate) {
            onZoneUpdate(safeZone, inZone);
          }
        }
        
        // Calculate movement direction - different for mobile vs PC
        const canvas = canvasRef.current;
        if (canvas) {
          const maxSpeed = calculateSpeed(me.size);
          
          if (isMobile && mobileDirection) {
            // Mobile: Use persistent direction from TouchControlArea
            console.log('Canvas: Using mobile direction:', mobileDirection);
            me.x += mobileDirection.x * maxSpeed;
            me.y += mobileDirection.y * maxSpeed;
          } else if (!isMobile) {
            // PC: Use mouse position
            const canvasWidth = canvas.width;
            const canvasHeight = canvas.height;
            
            // Calculate target position in world coordinates
            const targetX = cameraPosition.x - (canvasWidth / 2 - mousePosition.x) / cameraZoom;
            const targetY = cameraPosition.y - (canvasHeight / 2 - mousePosition.y) / cameraZoom;
            
            // Update last target position
            setLastTargetPosition({
              x: targetX,
              y: targetY
            });
            
            // Calculate movement direction
            const dx = targetX - me.x;
            const dy = targetY - me.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance > 5) {
              // Normalize direction to ensure consistent speed in all directions
              const directionX = dx / distance;
              const directionY = dy / distance;
              
              // Apply maximum speed in the normalized direction
              const actualSpeed = Math.min(maxSpeed, distance);
              
              me.x += directionX * actualSpeed;
              me.y += directionY * actualSpeed;
            }
          }
          
          // Game boundaries
          me.x = Math.max(me.size, Math.min(GAME_WIDTH - me.size, me.x));
          me.y = Math.max(me.size, Math.min(GAME_HEIGHT - me.size, me.y));
        }
        
        // Sync player position with other clients (throttled)
        if (!isLocalMode && onPlayerPositionSync && currentTime - lastPositionSync > 100) {
          setLastPositionSync(currentTime);
          onPlayerPositionSync({
            x: me.x,
            y: me.y,
            size: me.size,
            velocityX: 0,
            velocityY: 0
          });
        }
        
        // Check collisions with food
        setFoods(prevFoods => {
          const remainingFoods = prevFoods.filter(food => {
            const dx = me.x - food.x;
            const dy = me.y - food.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < me.size) {
              // Food eaten, increase player size
              me.size += FOOD_VALUE;
              return false;
            }
            return true;
          });
          
          // Respawn food if too few
          if (remainingFoods.length < FOOD_COUNT / 2) {
            const newFoodsCount = FOOD_COUNT - remainingFoods.length;
            const newFoods = Array(newFoodsCount).fill(0).map(() => ({
              id: Math.random().toString(36).substring(2, 9),
              x: Math.random() * GAME_WIDTH,
              y: Math.random() * GAME_HEIGHT,
              size: FOOD_SIZE
            }));
            return [...remainingFoods, ...newFoods];
          }
          
          return remainingFoods;
        });
        
        // Check collisions with rugs
        setRugs(prevRugs => {
          prevRugs.forEach(rug => {
            const dx = me.x - rug.x;
            const dy = me.y - rug.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < me.size + rug.size) {
              // Player hit a rug, decrease size
              me.size = Math.max(10, me.size - RUG_PENALTY);
              
              // Push player away from rug with limited movement
              if (distance > 0) {
                const pushFactor = Math.min(10, distance * 0.5);
                me.x += (dx / distance) * pushFactor;
                me.y += (dy / distance) * pushFactor;
                
                // Keep within boundaries after push
                me.x = Math.max(me.size, Math.min(GAME_WIDTH - me.size, me.x));
                me.y = Math.max(me.size, Math.min(GAME_HEIGHT - me.size, me.y));
              }
            }
          });
          return prevRugs;
        });
        
        // In local mode we don't have enemy players, so we skip player collision logic
        if (!isLocalMode) {
          // Check collisions with other players - IMPROVED with immediate game over
          for (let i = 0; i < updatedPlayers.length; i++) {
            if (i === ourPlayerIndex || !updatedPlayers[i].isAlive) continue;
            
            const otherPlayer = updatedPlayers[i];
            const dx = me.x - otherPlayer.x;
            const dy = me.y - otherPlayer.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            // If players collide
            if (distance < me.size + otherPlayer.size) {
              // Agar.io style: Player can only eat others that are significantly smaller
              if (me.size > otherPlayer.size * 1.2) {
                // Our player eats the other player
                otherPlayer.isAlive = false;
                me.size += otherPlayer.size / 2;
                
                // IMMEDIATE game over in multiplayer
                handlePlayerElimination(otherPlayer, me);
                
              } else if (otherPlayer.size > me.size * 1.2) {
                // We get eaten
                me.isAlive = false;
                
                // IMMEDIATE game over in multiplayer
                handlePlayerElimination(me, otherPlayer);
                
              } else {
                // If similar size, bounce off each other with limited movement
                const angle = Math.atan2(dy, dx);
                const pushDistance = Math.min(5, distance * 0.3);
                me.x += Math.cos(angle) * pushDistance;
                me.y += Math.sin(angle) * pushDistance;
                
                // Keep within boundaries after collision
                me.x = Math.max(me.size, Math.min(GAME_WIDTH - me.size, me.x));
                me.y = Math.max(me.size, Math.min(GAME_HEIGHT - me.size, me.y));
              }
            }
          }
        }
        
        // Update camera position to follow player with some smoothing
        setCameraPosition(prev => ({
          x: prev.x + (me.x - prev.x) * 0.1,
          y: prev.y + (me.y - prev.y) * 0.1
        }));
        
        // Limit zoom based on player size
        const maxSize = 50;
        const effectiveSize = Math.min(me.size, maxSize);
        setCameraZoom(prev => {
          const targetZoom = Math.max(0.5, Math.min(1.5, 20 / Math.sqrt(effectiveSize)));
          return prev + (targetZoom - prev) * 0.05; // Smooth zoom transition
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
  }, [gameInitialized, cameraZoom, cameraPosition, mousePosition, isLocalMode, isZoneMode, safeZone, lastDamageTime, onZoneUpdate, isMobile, mobileDirection, handlePlayerElimination, onPlayerPositionSync, lastPositionSync]);

  // Rendering - completely optimized with NFT image support
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    // Canvas size based on container
    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
    };
    
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    
    // Optimized drawing
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
      
      // Draw grid - with darker grid color
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
      
      // Draw safe zone for Zone Battle mode
      if (isZoneMode && safeZone && safeZone.isActive) {
        // Draw safe zone circle
        context.beginPath();
        context.strokeStyle = '#22c55e'; // Green
        context.lineWidth = 3 / cameraZoom;
        context.arc(safeZone.x, safeZone.y, safeZone.currentRadius, 0, Math.PI * 2);
        context.stroke();
        
        // Draw danger zone (outside safe zone)
        context.beginPath();
        context.strokeStyle = '#ef4444'; // Red
        context.lineWidth = 6 / cameraZoom;
        context.setLineDash([10 / cameraZoom, 10 / cameraZoom]);
        context.arc(safeZone.x, safeZone.y, safeZone.currentRadius + 20, 0, Math.PI * 2);
        context.stroke();
        context.setLineDash([]);
        
        // Fill danger zone with semi-transparent red
        context.globalCompositeOperation = 'multiply';
        context.fillStyle = 'rgba(239, 68, 68, 0.1)';
        context.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
        
        // Cut out the safe zone
        context.globalCompositeOperation = 'destination-out';
        context.beginPath();
        context.arc(safeZone.x, safeZone.y, safeZone.currentRadius, 0, Math.PI * 2);
        context.fill();
        
        context.globalCompositeOperation = 'source-over';
      }
      
      // Draw food
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
      
      // Draw players with NFT image support
      players.forEach(player => {
        if (!player.isAlive) return;
        
        context.save();
        
        // Check if player has NFT image and if it's loaded
        const hasNftImage = player.nftImageUrl && imageCache.has(player.nftImageUrl);
        
        if (hasNftImage) {
          const img = imageCache.get(player.nftImageUrl!);
          if (img) {
            // Draw NFT image as circular blob
            context.beginPath();
            context.arc(player.x, player.y, player.size, 0, Math.PI * 2);
            context.clip();
            
            // Draw the image to fill the circular area
            const imageSize = player.size * 2;
            context.drawImage(
              img,
              player.x - player.size,
              player.y - player.size,
              imageSize,
              imageSize
            );
            
            // Add a border around the NFT blob
            context.restore();
            context.save();
            context.beginPath();
            context.strokeStyle = '#ffffff';
            context.lineWidth = 2 / cameraZoom;
            context.arc(player.x, player.y, player.size, 0, Math.PI * 2);
            context.stroke();
          }
        } else {
          // Fallback to color blob if no NFT image
          context.beginPath();
          context.fillStyle = `#${getColorHex(player.color)}`;
          context.arc(player.x, player.y, player.size, 0, Math.PI * 2);
          context.fill();
        }
        
        // Draw player name and size
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
      
      // Restore context
      context.restore();
      
      // Optimized animation loop
      animationFrameRef.current = requestAnimationFrame(renderCanvas);
    };
    
    // Start the render loop
    animationFrameRef.current = requestAnimationFrame(renderCanvas);
    
    // Cleanup
    return () => {
      window.removeEventListener('resize', resizeCanvas);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [players, foods, rugs, cameraPosition, cameraZoom, isZoneMode, safeZone, imageCache]);

  // Helper function to get color hex
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
