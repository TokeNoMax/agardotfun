import React, { useRef, useEffect, useState } from "react";
import { useGame } from "@/context/GameContext";
import { Food, Rug, Player } from "@/types/game";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";

// Constants
const GAME_WIDTH = 2000;
const GAME_HEIGHT = 2000;
const FOOD_COUNT = 100;
const RUG_COUNT = 10;
const FOOD_SIZE = 5;
const RUG_SIZE = 40;
const FOOD_VALUE = 1;
const RUG_PENALTY = 5;

interface CanvasProps {
  onGameOver: (winner: Player | null) => void;
}

const Canvas: React.FC<CanvasProps> = ({ onGameOver }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { currentRoom, player: currentPlayer } = useGame();
  const [foods, setFoods] = useState<Food[]>([]);
  const [rugs, setRugs] = useState<Rug[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [cameraZoom, setCameraZoom] = useState<number>(1);
  const [cameraPosition, setCameraPosition] = useState({ x: 0, y: 0 });
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const { toast } = useToast();

  const playerRef = useRef(currentPlayer);
  const gameLoopRef = useRef<number | null>(null);
  const gameIdRef = useRef<string | null>(null);

  // Initialize game
  useEffect(() => {
    if (!currentRoom || currentRoom?.status !== 'playing' || !currentPlayer) return;
    
    // Initialize players with random positions
    const initialPlayers = currentRoom.players.map(p => ({
      ...p,
      x: Math.random() * (GAME_WIDTH - 100) + 50,
      y: Math.random() * (GAME_HEIGHT - 100) + 50,
      isAlive: true
    }));
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
    
    // Find our player from the current room
    const ourPlayer = initialPlayers.find(p => p.id === currentPlayer.id);
    if (ourPlayer) {
      playerRef.current = ourPlayer;
      
      // Update player position in Supabase
      updatePlayerPosition(currentRoom.id, ourPlayer);
      
      // Center camera on player
      setCameraPosition({ x: ourPlayer.x, y: ourPlayer.y });
    }
    
    // Subscribe to room_players changes for real-time updates
    const channel = supabase
      .channel('game-updates')
      .on('postgres_changes', 
        { event: 'UPDATE', schema: 'public', table: 'room_players', filter: `room_id=eq.${currentRoom.id}` }, 
        (payload) => {
          // Only update other players, not ourselves
          if (payload.new && payload.new.player_id !== currentPlayer.id) {
            updatePlayerFromSupabase(payload.new);
          }
        }
      )
      .subscribe();
      
    gameIdRef.current = channel.subscribe.toString();
    
    toast({
      title: "Bataille commencée !",
      description: "Mangez ou soyez mangé. Bonne chance !"
    });

    return () => {
      if (gameLoopRef.current) {
        cancelAnimationFrame(gameLoopRef.current);
      }
      
      if (gameIdRef.current) {
        supabase.removeChannel(channel);
      }
    };
  }, [currentRoom, currentPlayer, toast]);

  const updatePlayerFromSupabase = (newPlayerData: any) => {
    setPlayers(prevPlayers => {
      return prevPlayers.map(p => {
        if (p.id === newPlayerData.player_id) {
          return {
            ...p,
            size: newPlayerData.size,
            x: newPlayerData.x,
            y: newPlayerData.y,
            isAlive: newPlayerData.is_alive
          };
        }
        return p;
      });
    });
  };

  const updatePlayerPosition = async (roomId: string, player: Player) => {
    if (!player) return;
    
    try {
      await supabase
        .from('room_players')
        .update({
          x: player.x,
          y: player.y,
          size: player.size,
          is_alive: player.isAlive
        })
        .eq('room_id', roomId)
        .eq('player_id', player.id);
    } catch (error) {
      console.error('Error updating player position:', error);
    }
  };

  // Handle mouse movement
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

  // Game loop
  useEffect(() => {
    if (!currentRoom || !currentPlayer || currentRoom?.status !== 'playing') return;
    
    const ourPlayer = players.find(p => p.id === currentPlayer.id);
    if (!ourPlayer || !ourPlayer.isAlive) return;
    
    let lastUpdateTime = 0;
    
    const gameLoop = (timestamp: number) => {
      // Throttle Supabase updates to every 100ms
      const shouldUpdate = timestamp - lastUpdateTime > 100;
      
      setPlayers(prevPlayers => {
        // Only update if we have enough players
        if (prevPlayers.length <= 1) return prevPlayers;
        
        // Update our player's position toward mouse
        const ourPlayerIndex = prevPlayers.findIndex(p => p.id === currentPlayer.id);
        if (ourPlayerIndex === -1 || !prevPlayers[ourPlayerIndex].isAlive) {
          return prevPlayers;
        }
        
        const updatedPlayers = [...prevPlayers];
        const me = updatedPlayers[ourPlayerIndex];
        
        // Calculate movement direction
        const canvas = canvasRef.current;
        if (canvas) {
          const canvasWidth = canvas.width;
          const canvasHeight = canvas.height;
          
          // Calculate target position in world coordinates
          const targetX = cameraPosition.x - (canvasWidth / 2 - mousePosition.x) / cameraZoom;
          const targetY = cameraPosition.y - (canvasHeight / 2 - mousePosition.y) / cameraZoom;
          
          // Calculate movement direction
          const dx = targetX - me.x;
          const dy = targetY - me.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          // Smaller blobs move faster, larger blobs move slower
          const speedFactor = Math.max(0.5, 5 / Math.sqrt(me.size));
          const speed = 2 * speedFactor;
          
          if (distance > 5) {
            me.x += (dx / distance) * speed;
            me.y += (dy / distance) * speed;
            
            // Constrain player within game bounds
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
              
              // Push player away from rug
              if (distance > 0) {
                me.x += (dx / distance) * 10;
                me.y += (dy / distance) * 10;
              }
            }
          });
          return prevRugs;
        });
        
        // Check collisions with other players
        for (let i = 0; i < updatedPlayers.length; i++) {
          if (i === ourPlayerIndex || !updatedPlayers[i].isAlive) continue;
          
          const otherPlayer = updatedPlayers[i];
          const dx = me.x - otherPlayer.x;
          const dy = me.y - otherPlayer.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          // If players collide
          if (distance < me.size + otherPlayer.size) {
            // Larger player eats smaller player
            if (me.size > otherPlayer.size * 1.1) {
              // Our player eats the other player
              otherPlayer.isAlive = false;
              me.size += otherPlayer.size / 2;
              toast({
                title: "Joueur éliminé !",
                description: `Vous avez mangé ${otherPlayer.name} !`
              });
            } else if (otherPlayer.size > me.size * 1.1) {
              // We get eaten
              me.isAlive = false;
              toast({
                title: "Vous avez été éliminé !",
                description: `${otherPlayer.name} vous a mangé !`,
                variant: "destructive"
              });
            } else {
              // Bounce off each other if similar size
              const angle = Math.atan2(dy, dx);
              const pushDistance = 5;
              me.x += Math.cos(angle) * pushDistance;
              me.y += Math.sin(angle) * pushDistance;
            }
          }
        }
        
        // Update camera position to follow player
        setCameraPosition({ x: me.x, y: me.y });
        
        // Update zoom based on player size
        setCameraZoom(Math.max(0.5, 50 / Math.sqrt(me.size)));
        
        // Send player position to Supabase if enough time has passed
        if (shouldUpdate && currentRoom) {
          lastUpdateTime = timestamp;
          updatePlayerPosition(currentRoom.id, me);
        }
        
        // Check if game over
        const alivePlayers = updatedPlayers.filter(p => p.isAlive);
        if (alivePlayers.length <= 1) {
          const winner = alivePlayers.length === 1 ? alivePlayers[0] : null;
          // Mark game as finished in Supabase
          if (currentRoom) {
            supabase
              .from('rooms')
              .update({ status: 'finished' })
              .eq('id', currentRoom.id)
              .then(() => {
                onGameOver(winner);
              });
          } else {
            onGameOver(winner);
          }
          return updatedPlayers;
        }
        
        return updatedPlayers;
      });
      
      gameLoopRef.current = requestAnimationFrame(gameLoop);
    };
    
    gameLoopRef.current = requestAnimationFrame(gameLoop);
    
    return () => {
      if (gameLoopRef.current) {
        cancelAnimationFrame(gameLoopRef.current);
      }
    };
  }, [currentRoom, currentPlayer, cameraZoom, cameraPosition, mousePosition, players, onGameOver, toast]);

  // Draw game
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getBoundingClientRect();
    canvas.width = ctx.width;
    canvas.height = ctx.height;
    
    const context = canvas.getContext('2d');
    if (!context) return;
    
    // Clear canvas
    context.clearRect(0, 0, canvas.width, canvas.height);
    
    // Transform for camera position and zoom
    context.save();
    context.translate(canvas.width / 2, canvas.height / 2);
    context.scale(cameraZoom, cameraZoom);
    context.translate(-cameraPosition.x, -cameraPosition.y);
    
    // Draw grid
    context.beginPath();
    context.strokeStyle = '#eee';
    context.lineWidth = 1 / cameraZoom;
    
    const gridSize = 50;
    const startX = Math.floor((cameraPosition.x - canvas.width / (2 * cameraZoom)) / gridSize) * gridSize;
    const endX = Math.ceil((cameraPosition.x + canvas.width / (2 * cameraZoom)) / gridSize) * gridSize;
    const startY = Math.floor((cameraPosition.y - canvas.height / (2 * cameraZoom)) / gridSize) * gridSize;
    const endY = Math.ceil((cameraPosition.y + canvas.height / (2 * cameraZoom)) / gridSize) * gridSize;
    
    for (let x = startX; x <= endX; x += gridSize) {
      context.moveTo(x, startY);
      context.lineTo(x, endY);
    }
    
    for (let y = startY; y <= endY; y += gridSize) {
      context.moveTo(startX, y);
      context.lineTo(endX, y);
    }
    
    context.stroke();
    
    // Draw game bounds
    context.beginPath();
    context.strokeStyle = '#000';
    context.lineWidth = 2 / cameraZoom;
    context.strokeRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    
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
      
      // Draw small spikes
      for (let i = 0; i < 8; i++) {
        const angle = (Math.PI * 2 * i) / 8;
        const innerRadius = rug.size;
        const outerRadius = rug.size * 1.3;
        
        context.beginPath();
        context.strokeStyle = '#6c3483';
        context.lineWidth = 3 / cameraZoom;
        context.moveTo(
          rug.x + innerRadius * Math.cos(angle),
          rug.y + innerRadius * Math.sin(angle)
        );
        context.lineTo(
          rug.x + outerRadius * Math.cos(angle),
          rug.y + outerRadius * Math.sin(angle)
        );
        context.stroke();
      }
    });
    
    // Draw players
    players.forEach(player => {
      if (!player.isAlive) return;
      
      // Draw blob
      context.beginPath();
      context.fillStyle = `#${getColorHex(player.color)}`;
      context.arc(player.x, player.y, player.size, 0, Math.PI * 2);
      context.fill();
      
      // Draw outline
      context.beginPath();
      context.strokeStyle = '#fff';
      context.lineWidth = 2 / cameraZoom;
      context.arc(player.x, player.y, player.size, 0, Math.PI * 2);
      context.stroke();
      
      // Draw player name
      context.font = `${15 / cameraZoom}px Arial`;
      context.fillStyle = '#fff';
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillText(player.name, player.x, player.y);
    });
    
    // Restore context
    context.restore();
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
      className="w-full h-full bg-gray-100"
    />
  );
};

export default Canvas;
