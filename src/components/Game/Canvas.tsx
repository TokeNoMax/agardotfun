
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Player } from "@/types/game";
import { computeSpeed } from "@/services/game/speedUtil";
import { useIsMobile } from "@/hooks/use-mobile";
import TouchControlArea from "./TouchControlArea";
import { generateColor } from "@/utils/colorGenerator";
import { generateName } from "@/utils/nameGenerator";

interface CanvasProps {
  players: Record<string, Player>;
  foods: Array<{ id: string; x: number; y: number; size: number; value?: number }>;
  rugs: Array<{ id: string; x: number; y: number; size: number }>;
  onCollectFood: (foodId: string) => void;
  onCollision: (winnerId: string, loserId: string) => void;
  onScoreUpdate?: (playerId: string, newSize: number) => void;
  safeZone?: {
    x: number;
    y: number;
    radius: number;
    currentRadius: number;
    maxRadius: number;
    nextShrinkTime: number;
    shrinkDuration: number;
    isActive: boolean;
    shrinkInterval: number;
    damagePerSecond: number;
    shrinkPercentage: number;
  };
  isLocalMode?: boolean;
  isZoneMode?: boolean;
  gameMode?: 'multiplayer' | 'zone' | 'local';
}

const Canvas: React.FC<CanvasProps> = ({
  players: externalPlayers,
  foods,
  rugs,
  onCollectFood,
  onCollision,
  onScoreUpdate,
  safeZone,
  isLocalMode = false,
  isZoneMode = false,
  gameMode = 'multiplayer'
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const animationFrameRef = useRef<number>(0);
  const isMobile = useIsMobile();

  const [players, setPlayers] = useState<Record<string, Player>>(externalPlayers || {});
  const [bots, setBots] = useState<Record<string, Player>>({});
  const [lastUpdateTime, setLastUpdateTime] = useState(Date.now());

  // Camera state
  const [camera, setCamera] = useState({ x: 0, y: 0, zoom: 1 });
  const [targetPosition, setTargetPosition] = useState<{ x: number; y: number } | null>(null);
  const [mousePosition, setMousePosition] = useState<{ x: number; y: number } | null>(null);
  const [touchDirection, setTouchDirection] = useState<{ x: number; y: number } | null>(null);
  const [keysPressed, setKeysPressed] = useState<Record<string, boolean>>({});
  const [isPlayerInZone, setIsPlayerInZone] = useState(true);

  // Game world boundaries
  const WORLD_WIDTH = 3000;
  const WORLD_HEIGHT = 3000;

  // Enhanced bot initialization for solo mode
  const initSoloBots = useCallback(() => {
    if (!isLocalMode) return;
    
    console.log("Initializing solo bots...");
    const botCount = 7;
    const newBots: Record<string, Player> = {};
    
    for (let i = 0; i < botCount; i++) {
      const botId = `bot_${i}`;
      const botName = generateName();
      const botColor = generateColor();
      
      const bot: Player = {
        id: botId,
        walletAddress: `bot_wallet_${i}`,
        name: botName,
        color: botColor,
        size: 15 + Math.random() * 10,
        x: 400 + Math.random() * 2200,
        y: 400 + Math.random() * 2200,
        isAlive: true,
        isReady: true,
        velocityX: 0,
        velocityY: 0
      };
      
      newBots[botId] = bot;
    }
    
    setBots(newBots);
    console.log(`Initialized ${Object.keys(newBots).length} bots for solo mode`);
  }, [isLocalMode]);

  // Enhanced bot updates with score synchronization
  const updateSoloBots = useCallback((deltaTime: number) => {
    if (!isLocalMode || Object.keys(bots).length === 0) return;

    setBots(prevBots => {
      const updatedBots = { ...prevBots };
      let scoreUpdated = false;

      Object.values(updatedBots).forEach(bot => {
        if (!bot.isAlive) return;

        // Random movement with some persistence
        if (Math.random() < 0.02) {
          bot.velocityX = (Math.random() - 0.5) * 2;
          bot.velocityY = (Math.random() - 0.5) * 2;
        }

        // Normalize velocity vector
        const speed = computeSpeed(bot.size);
        const magnitude = Math.sqrt(bot.velocityX * bot.velocityX + bot.velocityY * bot.velocityY) || 1;
        const normalizedVx = bot.velocityX / magnitude;
        const normalizedVy = bot.velocityY / magnitude;

        // Update position
        bot.x += normalizedVx * speed * deltaTime;
        bot.y += normalizedVy * speed * deltaTime;

        // Keep bots within world boundaries
        bot.x = Math.max(0, Math.min(WORLD_WIDTH, bot.x));
        bot.y = Math.max(0, Math.min(WORLD_HEIGHT, bot.y));

        // Enhanced collision detection with score updates
        foods.forEach(food => {
          const dx = bot.x - food.x;
          const dy = bot.y - food.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          const botRadius = Math.sqrt(bot.size);
          
          if (distance < botRadius + food.size) {
            const oldSize = bot.size;
            bot.size += food.value || 2;
            
            // Notify parent of bot score update
            if (onScoreUpdate && bot.size !== oldSize) {
              onScoreUpdate(bot.id, bot.size);
              scoreUpdated = true;
            }
            
            // Remove food
            onCollectFood?.(food.id);
          }
        });

        // Bot vs bot collisions with score updates
        Object.values(updatedBots).forEach(otherBot => {
          if (otherBot.id === bot.id || !otherBot.isAlive) return;
          
          const dx = bot.x - otherBot.x;
          const dy = bot.y - otherBot.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          const botRadius = Math.sqrt(bot.size);
          const otherRadius = Math.sqrt(otherBot.size);
          
          if (distance < (botRadius + otherRadius) * 0.8) {
            if (bot.size > otherBot.size * 1.1) {
              const oldSize = bot.size;
              bot.size += otherBot.size * 0.5;
              otherBot.isAlive = false;
              
              // Notify parent of bot score update
              if (onScoreUpdate && bot.size !== oldSize) {
                onScoreUpdate(bot.id, bot.size);
                scoreUpdated = true;
              }
            }
          }
        });

        // Apply zone damage if outside safe zone
        if (safeZone && safeZone.isActive) {
          const dx = bot.x - safeZone.x;
          const dy = bot.y - safeZone.y;
          const distanceFromCenter = Math.sqrt(dx * dx + dy * dy);
          
          if (distanceFromCenter > safeZone.currentRadius) {
            bot.size -= safeZone.damagePerSecond * deltaTime;
            if (bot.size <= 5) {
              bot.isAlive = false;
            }
          }
        }
      });

      return updatedBots;
    });
  }, [isLocalMode, bots, foods, onCollectFood, onScoreUpdate, safeZone]);

  // Initialize canvas context
  useEffect(() => {
    if (canvasRef.current) {
      ctxRef.current = canvasRef.current.getContext("2d");
      
      // Focus canvas for keyboard controls
      canvasRef.current.focus();
    }
    
    // Initialize bots for solo mode
    if (isLocalMode) {
      initSoloBots();
    }
    
    return () => {
      cancelAnimationFrame(animationFrameRef.current);
    };
  }, [isLocalMode, initSoloBots]);

  // Update players state when external players change
  useEffect(() => {
    setPlayers(externalPlayers || {});
  }, [externalPlayers]);

  // Handle mouse movement
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (canvas.width / rect.width);
    const y = (e.clientY - rect.top) * (canvas.height / rect.height);
    
    setMousePosition({ x, y });
  }, []);

  // Handle keyboard input
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    setKeysPressed(prev => ({ ...prev, [e.key]: true }));
  }, []);

  const handleKeyUp = useCallback((e: React.KeyboardEvent) => {
    setKeysPressed(prev => ({ ...prev, [e.key]: false }));
  }, []);

  // Handle touch direction changes
  const handleTouchDirectionChange = useCallback((direction: { x: number; y: number } | null) => {
    setTouchDirection(direction);
  }, []);

  // Update player movement based on input
  const updatePlayerMovement = useCallback((deltaTime: number) => {
    const currentPlayer = Object.values(players).find(p => p.isAlive);
    if (!currentPlayer) return;

    let targetX = currentPlayer.x;
    let targetY = currentPlayer.y;
    
    // Handle keyboard input
    if (Object.values(keysPressed).some(pressed => pressed)) {
      const speed = computeSpeed(currentPlayer.size) * deltaTime;
      if (keysPressed.w || keysPressed.ArrowUp) targetY -= speed;
      if (keysPressed.s || keysPressed.ArrowDown) targetY += speed;
      if (keysPressed.a || keysPressed.ArrowLeft) targetX -= speed;
      if (keysPressed.d || keysPressed.ArrowRight) targetX += speed;
      
      setTargetPosition({ x: targetX, y: targetY });
    }
    // Handle mouse input
    else if (mousePosition && canvasRef.current) {
      const canvas = canvasRef.current;
      const worldX = mousePosition.x / camera.zoom + camera.x - canvas.width / (2 * camera.zoom);
      const worldY = mousePosition.y / camera.zoom + camera.y - canvas.height / (2 * camera.zoom);
      
      setTargetPosition({ x: worldX, y: worldY });
    }
    // Handle touch input
    else if (touchDirection) {
      const speed = computeSpeed(currentPlayer.size) * deltaTime;
      targetX += touchDirection.x * speed;
      targetY += touchDirection.y * speed;
      
      setTargetPosition({ x: targetX, y: targetY });
    }
    
    // Move player towards target
    if (targetPosition) {
      const dx = targetPosition.x - currentPlayer.x;
      const dy = targetPosition.y - currentPlayer.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance > 1) {
        const speed = computeSpeed(currentPlayer.size) * deltaTime;
        const moveX = (dx / distance) * speed;
        const moveY = (dy / distance) * speed;
        
        const newX = Math.max(0, Math.min(WORLD_WIDTH, currentPlayer.x + moveX));
        const newY = Math.max(0, Math.min(WORLD_HEIGHT, currentPlayer.y + moveY));
        
        setPlayers(prev => ({
          ...prev,
          [currentPlayer.id]: {
            ...prev[currentPlayer.id],
            x: newX,
            y: newY,
            velocityX: moveX / deltaTime,
            velocityY: moveY / deltaTime
          }
        }));
      }
    }
  }, [players, targetPosition, mousePosition, keysPressed, touchDirection, camera]);

  // Check collisions between player and food
  const checkFoodCollisions = useCallback(() => {
    const currentPlayer = Object.values(players).find(p => p.isAlive);
    if (!currentPlayer) return;
    
    foods.forEach(food => {
      const dx = currentPlayer.x - food.x;
      const dy = currentPlayer.y - food.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const playerRadius = Math.sqrt(currentPlayer.size);
      
      if (distance < playerRadius + food.size) {
        const oldSize = currentPlayer.size;
        const newSize = currentPlayer.size + (food.value || 2);
        
        setPlayers(prev => ({
          ...prev,
          [currentPlayer.id]: {
            ...prev[currentPlayer.id],
            size: newSize
          }
        }));
        
        onCollectFood(food.id);
        
        // Notify parent of score update
        if (onScoreUpdate && newSize !== oldSize) {
          onScoreUpdate(currentPlayer.id, newSize);
        }
      }
    });
  }, [players, foods, onCollectFood, onScoreUpdate]);

  // Check collisions between player and other players
  const checkPlayerCollisions = useCallback(() => {
    const currentPlayer = Object.values(players).find(p => p.isAlive);
    if (!currentPlayer) return;
    
    Object.values(players).forEach(otherPlayer => {
      if (otherPlayer.id === currentPlayer.id || !otherPlayer.isAlive) return;
      
      const dx = currentPlayer.x - otherPlayer.x;
      const dy = currentPlayer.y - otherPlayer.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const playerRadius = Math.sqrt(currentPlayer.size);
      const otherRadius = Math.sqrt(otherPlayer.size);
      
      if (distance < (playerRadius + otherRadius) * 0.8) {
        if (currentPlayer.size > otherPlayer.size * 1.1) {
          const oldSize = currentPlayer.size;
          const newSize = currentPlayer.size + otherPlayer.size * 0.5;
          
          setPlayers(prev => ({
            ...prev,
            [currentPlayer.id]: {
              ...prev[currentPlayer.id],
              size: newSize
            }
          }));
          
          onCollision(currentPlayer.id, otherPlayer.id);
          
          // Notify parent of score update
          if (onScoreUpdate && newSize !== oldSize) {
            onScoreUpdate(currentPlayer.id, newSize);
          }
        }
      }
    });
    
    // Check collisions with bots in local mode
    if (isLocalMode) {
      Object.values(bots).forEach(bot => {
        if (!bot.isAlive) return;
        
        const dx = currentPlayer.x - bot.x;
        const dy = currentPlayer.y - bot.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const playerRadius = Math.sqrt(currentPlayer.size);
        const botRadius = Math.sqrt(bot.size);
        
        if (distance < (playerRadius + botRadius) * 0.8) {
          if (currentPlayer.size > bot.size * 1.1) {
            const oldSize = currentPlayer.size;
            const newSize = currentPlayer.size + bot.size * 0.5;
            
            setPlayers(prev => ({
              ...prev,
              [currentPlayer.id]: {
                ...prev[currentPlayer.id],
                size: newSize
              }
            }));
            
            setBots(prev => ({
              ...prev,
              [bot.id]: {
                ...prev[bot.id],
                isAlive: false
              }
            }));
            
            // Notify parent of score update
            if (onScoreUpdate && newSize !== oldSize) {
              onScoreUpdate(currentPlayer.id, newSize);
            }
          } else if (bot.size > currentPlayer.size * 1.1) {
            // Player gets eaten by bot
            setPlayers(prev => ({
              ...prev,
              [currentPlayer.id]: {
                ...prev[currentPlayer.id],
                isAlive: false
              }
            }));
            
            const oldBotSize = bot.size;
            const newBotSize = bot.size + currentPlayer.size * 0.5;
            
            setBots(prev => ({
              ...prev,
              [bot.id]: {
                ...prev[bot.id],
                size: newBotSize
              }
            }));
            
            // Notify parent of bot score update
            if (onScoreUpdate && newBotSize !== oldBotSize) {
              onScoreUpdate(bot.id, newBotSize);
            }
          }
        }
      });
    }
  }, [players, bots, isLocalMode, onCollision, onScoreUpdate]);

  // Check collisions between player and rugs
  const checkRugCollisions = useCallback(() => {
    const currentPlayer = Object.values(players).find(p => p.isAlive);
    if (!currentPlayer) return;
    
    rugs.forEach(rug => {
      const dx = currentPlayer.x - rug.x;
      const dy = currentPlayer.y - rug.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const playerRadius = Math.sqrt(currentPlayer.size);
      
      if (distance < playerRadius + rug.size) {
        // Player touched a rug, reduce size
        const newSize = Math.max(10, currentPlayer.size * 0.9);
        
        setPlayers(prev => ({
          ...prev,
          [currentPlayer.id]: {
            ...prev[currentPlayer.id],
            size: newSize
          }
        }));
        
        // Notify parent of score update
        if (onScoreUpdate) {
          onScoreUpdate(currentPlayer.id, newSize);
        }
      }
    });
  }, [players, rugs, onScoreUpdate]);

  // Check if player is in safe zone
  const checkSafeZone = useCallback(() => {
    if (!safeZone || !safeZone.isActive) {
      setIsPlayerInZone(true);
      return;
    }
    
    const currentPlayer = Object.values(players).find(p => p.isAlive);
    if (!currentPlayer) return;
    
    const dx = currentPlayer.x - safeZone.x;
    const dy = currentPlayer.y - safeZone.y;
    const distanceFromCenter = Math.sqrt(dx * dx + dy * dy);
    const isInZone = distanceFromCenter <= safeZone.currentRadius;
    
    setIsPlayerInZone(isInZone);
    
    // Apply damage if outside zone
    if (!isInZone) {
      const newSize = Math.max(5, currentPlayer.size - safeZone.damagePerSecond * 0.016);
      
      if (newSize <= 5) {
        // Player died from zone damage
        setPlayers(prev => ({
          ...prev,
          [currentPlayer.id]: {
            ...prev[currentPlayer.id],
            isAlive: false,
            size: 5
          }
        }));
      } else {
        setPlayers(prev => ({
          ...prev,
          [currentPlayer.id]: {
            ...prev[currentPlayer.id],
            size: newSize
          }
        }));
        
        // Notify parent of score update
        if (onScoreUpdate) {
          onScoreUpdate(currentPlayer.id, newSize);
        }
      }
    }
  }, [players, safeZone, onScoreUpdate]);

  // Update camera position to follow player
  const updateCamera = useCallback(() => {
    const currentPlayer = Object.values(players).find(p => p.isAlive);
    if (!currentPlayer || !canvasRef.current) return;
    
    const canvas = canvasRef.current;
    
    // Calculate zoom based on player size
    const baseZoom = Math.min(canvas.width, canvas.height) / 1000;
    const sizeZoom = 1 / Math.sqrt(currentPlayer.size / 15);
    const targetZoom = baseZoom * Math.min(1.5, Math.max(0.5, sizeZoom));
    
    // Smooth camera movement
    const smoothing = 0.1;
    const newZoom = camera.zoom + (targetZoom - camera.zoom) * smoothing;
    const newX = currentPlayer.x;
    const newY = currentPlayer.y;
    
    setCamera({
      x: newX,
      y: newY,
      zoom: newZoom
    });
  }, [players, camera]);

  // Enhanced render function that combines players and bots
  const renderGame = useCallback(() => {
    if (!canvasRef.current || !ctxRef.current) return;

    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw background grid
    ctx.save();
    ctx.fillStyle = "#111827";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Apply camera transformation
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.scale(camera.zoom, camera.zoom);
    ctx.translate(-camera.x, -camera.y);
    
    // Draw grid
    ctx.beginPath();
    ctx.strokeStyle = "#1f2937";
    ctx.lineWidth = 1 / camera.zoom;
    
    const gridSize = 100;
    const startX = Math.floor((camera.x - canvas.width / (2 * camera.zoom)) / gridSize) * gridSize;
    const startY = Math.floor((camera.y - canvas.height / (2 * camera.zoom)) / gridSize) * gridSize;
    const endX = Math.ceil((camera.x + canvas.width / (2 * camera.zoom)) / gridSize) * gridSize;
    const endY = Math.ceil((camera.y + canvas.height / (2 * camera.zoom)) / gridSize) * gridSize;
    
    for (let x = startX; x <= endX; x += gridSize) {
      ctx.moveTo(x, startY);
      ctx.lineTo(x, endY);
    }
    
    for (let y = startY; y <= endY; y += gridSize) {
      ctx.moveTo(startX, y);
      ctx.lineTo(endX, y);
    }
    
    ctx.stroke();

    // Combine players and bots for rendering
    const allPlayers = { ...players, ...bots };
    
    // Draw world boundaries
    ctx.strokeStyle = "#ff0000";
    ctx.lineWidth = 2 / camera.zoom;
    ctx.strokeRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    
    // Draw safe zone if active
    if (safeZone && safeZone.isActive) {
      ctx.beginPath();
      ctx.arc(safeZone.x, safeZone.y, safeZone.currentRadius, 0, Math.PI * 2);
      ctx.strokeStyle = isPlayerInZone ? "rgba(0, 255, 0, 0.8)" : "rgba(255, 0, 0, 0.8)";
      ctx.lineWidth = 3 / camera.zoom;
      ctx.stroke();
      
      // Draw zone fill
      ctx.fillStyle = isPlayerInZone ? "rgba(0, 255, 0, 0.1)" : "rgba(255, 0, 0, 0.1)";
      ctx.fill();
      
      // Draw danger zone
      ctx.beginPath();
      ctx.arc(safeZone.x, safeZone.y, safeZone.maxRadius, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255, 0, 0, 0.2)";
      ctx.fill();
    }
    
    // Draw foods
    foods.forEach(food => {
      ctx.beginPath();
      ctx.arc(food.x, food.y, food.size, 0, Math.PI * 2);
      ctx.fillStyle = "#4ade80";
      ctx.fill();
    });
    
    // Draw rugs
    rugs.forEach(rug => {
      ctx.beginPath();
      ctx.arc(rug.x, rug.y, rug.size, 0, Math.PI * 2);
      ctx.fillStyle = "#a855f7";
      ctx.fill();
      
      // Draw rug pattern
      ctx.beginPath();
      ctx.arc(rug.x, rug.y, rug.size * 0.7, 0, Math.PI * 2);
      ctx.fillStyle = "#7e22ce";
      ctx.fill();
      
      ctx.beginPath();
      ctx.arc(rug.x, rug.y, rug.size * 0.4, 0, Math.PI * 2);
      ctx.fillStyle = "#581c87";
      ctx.fill();
    });

    // Render all players (including bots)
    Object.values(allPlayers).forEach(player => {
      if (!player.isAlive) return;
      
      const radius = Math.sqrt(player.size);
      
      // Draw player circle
      ctx.beginPath();
      ctx.arc(player.x, player.y, radius, 0, Math.PI * 2);
      
      // Use player color or default to blue
      let fillColor = "#3b82f6";
      switch (player.color) {
        case "red": fillColor = "#ef4444"; break;
        case "green": fillColor = "#10b981"; break;
        case "blue": fillColor = "#3b82f6"; break;
        case "yellow": fillColor = "#f59e0b"; break;
        case "purple": fillColor = "#8b5cf6"; break;
        case "orange": fillColor = "#f97316"; break;
        case "cyan": fillColor = "#06b6d4"; break;
        case "pink": fillColor = "#ec4899"; break;
      }
      
      ctx.fillStyle = fillColor;
      ctx.fill();
      
      // Draw player name
      if (player.name) {
        ctx.font = `${14 / camera.zoom}px Arial`;
        ctx.fillStyle = "#ffffff";
        ctx.textAlign = "center";
        ctx.fillText(player.name, player.x, player.y - radius - 5 / camera.zoom);
      }
    });
    
    ctx.restore();
  }, [players, bots, foods, rugs, camera, safeZone, isPlayerInZone]);

  // Game loop
  useEffect(() => {
    const gameLoop = (timestamp: number) => {
      const now = Date.now();
      const deltaTime = Math.min(0.05, (now - lastUpdateTime) / 1000); // Cap at 50ms to prevent large jumps
      
      updatePlayerMovement(deltaTime);
      checkFoodCollisions();
      checkPlayerCollisions();
      checkRugCollisions();
      
      if (isZoneMode && safeZone) {
        checkSafeZone();
      }
      
      updateCamera();
      
      // Update bots in local mode
      if (isLocalMode) {
        updateSoloBots(deltaTime);
      }
      
      renderGame();
      
      setLastUpdateTime(now);
      animationFrameRef.current = requestAnimationFrame(gameLoop);
    };
    
    animationFrameRef.current = requestAnimationFrame(gameLoop);
    
    return () => {
      cancelAnimationFrame(animationFrameRef.current);
    };
  }, [
    lastUpdateTime, 
    updatePlayerMovement, 
    checkFoodCollisions, 
    checkPlayerCollisions, 
    checkRugCollisions, 
    checkSafeZone, 
    updateCamera, 
    renderGame, 
    isZoneMode, 
    safeZone, 
    isLocalMode, 
    updateSoloBots
  ]);

  return (
    <div className="relative w-full h-full overflow-hidden bg-gray-900">
      <canvas
        ref={canvasRef}
        width={800}
        height={600}
        className="w-full h-full cursor-none"
        onMouseMove={handleMouseMove}
        onKeyDown={handleKeyDown}
        onKeyUp={handleKeyUp}
        tabIndex={0}
        style={{ outline: 'none' }}
      />
      {isMobile && (
        <TouchControlArea onDirectionChange={handleTouchDirectionChange} />
      )}
      {safeZone && safeZone.isActive && !isPlayerInZone && (
        <div className="absolute top-1/4 left-0 right-0 text-center pointer-events-none">
          <div className="inline-block bg-red-500/80 text-white px-4 py-2 rounded-full animate-pulse">
            ⚠️ ZONE DANGER! ⚠️
          </div>
        </div>
      )}
    </div>
  );
};

export default Canvas;
