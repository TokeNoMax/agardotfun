import React, { useRef, useEffect, useState } from "react";
import { useGame } from "@/context/GameContext";
import { Food, Rug, Player } from "@/types/game";

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

interface CanvasProps {
  onGameOver: (winner: Player | null) => void;
  isLocalMode?: boolean;
  localPlayer?: Player | null;
}

const Canvas: React.FC<CanvasProps> = ({ onGameOver, isLocalMode = false, localPlayer = null }) => {
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

  const playerRef = useRef(isLocalMode ? localPlayer : currentPlayer);
  const gameLoopRef = useRef<number | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const isInitializedRef = useRef<boolean>(false);

  // Game initialization - simplified for local mode
  useEffect(() => {
    if (isInitializedRef.current) return;
    isInitializedRef.current = true;
    
    // For local mode, don't check currentRoom status
    const shouldInitialize = isLocalMode ? true : 
      (currentRoom?.status === 'playing' && !!currentPlayer);
    
    if (!shouldInitialize) return;
    
    let initialPlayers: Player[] = [];
    
    if (isLocalMode && localPlayer) {
      // In local mode, just use the local player
      initialPlayers = [localPlayer];
      playerRef.current = localPlayer;
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
    
    setPlayers(initialPlayers);
    
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
      isInitializedRef.current = false;
      if (gameLoopRef.current) {
        cancelAnimationFrame(gameLoopRef.current);
        gameLoopRef.current = null;
      }
      
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [currentRoom, currentPlayer, isLocalMode, localPlayer]);

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

  // Game loop - optimized for local mode with smoothing
  useEffect(() => {
    // Local mode uses localPlayer, online mode uses currentPlayer from currentRoom
    const activePlayer = isLocalMode ? localPlayer : 
      (currentRoom?.status === 'playing' && currentPlayer) ? currentPlayer : null;
      
    if (!activePlayer) return;
    
    const gameLoop = (timestamp: number) => {
      setPlayers(prevPlayers => {
        if (prevPlayers.length === 0) return prevPlayers;
        
        // Find our player index
        const ourPlayerIndex = prevPlayers.findIndex(p => 
          p.id === (isLocalMode ? localPlayer?.id : currentPlayer?.id)
        );
        
        if (ourPlayerIndex === -1 || !prevPlayers[ourPlayerIndex].isAlive) {
          return prevPlayers;
        }
        
        const updatedPlayers = [...prevPlayers];
        const me = updatedPlayers[ourPlayerIndex];
        
        // Calculate movement direction with smoothing
        const canvas = canvasRef.current;
        if (canvas) {
          const canvasWidth = canvas.width;
          const canvasHeight = canvas.height;
          
          // Calculate target position in world coordinates with smoothing
          const targetX = cameraPosition.x - (canvasWidth / 2 - mousePosition.x) / cameraZoom;
          const targetY = cameraPosition.y - (canvasHeight / 2 - mousePosition.y) / cameraZoom;
          
          // Update last target position with some smoothing
          setLastTargetPosition(prev => ({
            x: targetX,
            y: targetY
          }));
          
          // Calculate movement direction with smoothing to avoid teleportation
          const dx = targetX - me.x;
          const dy = targetY - me.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          // Slower speed for larger blobs with better speed calculation
          const speedFactor = Math.max(0.5, 3 / Math.sqrt(me.size));
          const speed = 2 * speedFactor;
          
          // Maximum movement per frame to avoid teleportation
          const maxMovementPerFrame = speed;
          
          if (distance > 5) {
            // Apply movement with limited speed to avoid teleportation
            const moveX = Math.min(Math.abs(dx), maxMovementPerFrame) * (dx > 0 ? 1 : -1);
            const moveY = Math.min(Math.abs(dy), maxMovementPerFrame) * (dy > 0 ? 1 : -1);
            
            me.x += moveX;
            me.y += moveY;
            
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
  }, [cameraZoom, cameraPosition, mousePosition, players, onGameOver, currentRoom, currentPlayer, isLocalMode, localPlayer]);

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
  }, [players, foods, rugs, cameraPosition, cameraZoom]);

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
