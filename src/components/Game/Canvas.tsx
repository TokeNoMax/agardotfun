import React, { useRef, useEffect, useState } from "react";
import { useGame } from "@/context/GameContext";
import { Food, Rug, Player, SafeZone } from "@/types/game";

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
  onGameOver: (winner: Player | null) => void;
  isLocalMode?: boolean;
  localPlayer?: Player | null;
  isZoneMode?: boolean;
  onZoneUpdate?: (zone: SafeZone, isPlayerInZone: boolean) => void;
}

const Canvas: React.FC<CanvasProps> = ({ 
  onGameOver, 
  isLocalMode = false, 
  localPlayer = null,
  isZoneMode = false,
  onZoneUpdate
}) => {
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
  
  // Zone Battle state
  const [safeZone, setSafeZone] = useState<SafeZone | null>(null);
  const [gameStartTime, setGameStartTime] = useState<number>(0);
  const [lastDamageTime, setLastDamageTime] = useState<number>(0);

  const playerRef = useRef<Player | null>(null);
  const gameLoopRef = useRef<number | null>(null);
  const animationFrameRef = useRef<number | null>(null);

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
    return {
      x: GAME_WIDTH / 2,
      y: GAME_HEIGHT / 2,
      currentRadius: INITIAL_ZONE_RADIUS,
      maxRadius: INITIAL_ZONE_RADIUS,
      nextShrinkTime: Date.now() + 30000, // 30 seconds grace period
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

  // Game initialization - simplified and fixed for local mode
  useEffect(() => {
    console.log("Initializing game - isLocalMode:", isLocalMode, "localPlayer:", localPlayer, "currentRoom:", currentRoom?.status, "isZoneMode:", isZoneMode);
    
    // Clear any existing game loops
    if (gameLoopRef.current) {
      cancelAnimationFrame(gameLoopRef.current);
      gameLoopRef.current = null;
    }
    
    // For local mode, don't check currentRoom status
    const shouldInitialize = isLocalMode ? !!localPlayer : 
      (currentRoom?.status === 'playing' && !!currentPlayer);
    
    if (!shouldInitialize) {
      console.log("Not initializing - conditions not met");
      return;
    }
    
    let initialPlayers: Player[] = [];
    
    if (isLocalMode && localPlayer) {
      // In local mode, just use the local player
      console.log("Setting up local player:", localPlayer);
      initialPlayers = [{
        ...localPlayer,
        x: GAME_WIDTH / 2,
        y: GAME_HEIGHT / 2,
        isAlive: true,
        size: 15
      }];
      playerRef.current = initialPlayers[0];
    } else if (currentRoom) {
      // In online mode, use players from currentRoom
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
    }
    
    console.log("Initial players setup:", initialPlayers);
    setPlayers(initialPlayers);
    
    // Initialize safe zone for Zone Battle mode
    if (isZoneMode) {
      const zone = initializeSafeZone();
      setSafeZone(zone);
      setGameStartTime(Date.now());
      console.log("Zone Battle mode initialized with safe zone:", zone);
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
  }, [currentRoom, currentPlayer, isLocalMode, localPlayer, isZoneMode]);

  // Mouse movement - with smoothing
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!canvasRef.current) return;
      
      const rect = canvasRef.current.getBoundingClientRect();
      setMousePosition({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      });
    };
    
    window.addEventListener('mousemove', handleMouseMove);
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);

  // Game loop - optimized for local mode with smoothing and zone logic
  useEffect(() => {
    // Make sure we have a player reference
    if (!playerRef.current) {
      console.log("No player ref, skipping game loop");
      return;
    }
    
    console.log("Starting game loop with player:", playerRef.current);
    
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
              currentRadius: Math.max(50, newRadius), // Minimum radius of 50
              nextShrinkTime: currentTime + updatedZone.shrinkInterval
            };
            console.log("Zone shrunk to radius:", updatedZone.currentRadius);
          }
          
          return updatedZone;
        });
      }
      
      setPlayers(prevPlayers => {
        if (prevPlayers.length === 0) {
          console.log("No players, skipping update");
          return prevPlayers;
        }
        
        // Find our player index
        const ourPlayerIndex = prevPlayers.findIndex(p => 
          p.id === playerRef.current?.id
        );
        
        if (ourPlayerIndex === -1 || !prevPlayers[ourPlayerIndex].isAlive) {
          console.log("Player not found or not alive, skipping update");
          return prevPlayers;
        }
        
        const updatedPlayers = [...prevPlayers];
        const me = updatedPlayers[ourPlayerIndex];
        
        // Zone Battle: Check if player is outside safe zone and apply damage
        if (isZoneMode && safeZone && playerRef.current) {
          const inZone = isPlayerInSafeZone(me, safeZone);
          
          if (!inZone && currentTime - lastDamageTime >= 1000) { // Damage every second
            me.size = Math.max(10, me.size - safeZone.damagePerSecond);
            setLastDamageTime(currentTime);
            console.log("Player took zone damage, size now:", me.size);
          }
          
          // Update zone info for UI
          if (onZoneUpdate) {
            const timeUntilShrink = Math.max(0, safeZone.nextShrinkTime - currentTime);
            onZoneUpdate(safeZone, inZone);
          }
        }
        
        // Calculate movement direction with proper normalization and progressive speed
        const canvas = canvasRef.current;
        if (canvas) {
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
          
          // Use the new progressive speed calculation
          const maxSpeed = calculateSpeed(me.size);
          
          if (distance > 5) {
            // Normalize direction to ensure consistent speed in all directions
            const directionX = dx / distance;
            const directionY = dy / distance;
            
            // Apply maximum speed in the normalized direction
            const actualSpeed = Math.min(maxSpeed, distance);
            
            me.x += directionX * actualSpeed;
            me.y += directionY * actualSpeed;
            
            // Game boundaries
            me.x = Math.max(me.size, Math.min(GAME_WIDTH - me.size, me.x));
            me.y = Math.max(me.size, Math.min(GAME_HEIGHT - me.size, me.y));
          }
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
          // Check collisions with other players
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
              } else if (otherPlayer.size > me.size * 1.2) {
                // We get eaten
                me.isAlive = false;
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
        
        // Game over condition - for local mode, we don't end the game automatically
        if (!isLocalMode && !gameOverCalled) {
          const alivePlayers = updatedPlayers.filter(p => p.isAlive);
          if (updatedPlayers.length > 1 && alivePlayers.length <= 1) {
            const winner = alivePlayers.length === 1 ? alivePlayers[0] : null;
            setGameOverCalled(true);
            onGameOver(winner);
          }
        }
        
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
  }, [cameraZoom, cameraPosition, mousePosition, players, onGameOver, currentRoom, currentPlayer, isLocalMode, localPlayer, isZoneMode, safeZone, lastDamageTime, onZoneUpdate]);

  // Rendering - completely optimized
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
      
      // Draw players
      players.forEach(player => {
        if (!player.isAlive) return;
        
        // Simple drawing for blobs
        context.beginPath();
        context.fillStyle = `#${getColorHex(player.color)}`;
        context.arc(player.x, player.y, player.size, 0, Math.PI * 2);
        context.fill();
        
        // Draw player name and size
        context.font = `${14 / cameraZoom}px Arial`;
        context.fillStyle = '#fff';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText(`${player.name} (${Math.round(player.size)})`, player.x, player.y);
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
  }, [players, foods, rugs, cameraPosition, cameraZoom, isZoneMode, safeZone]);

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
    />
  );
};

export default Canvas;
