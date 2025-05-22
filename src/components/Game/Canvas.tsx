
import React, { useRef, useEffect, useState } from "react";
import { useGame } from "@/context/GameContext";
import { Food, Rug, Player } from "@/types/game";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";

// Constants - Simplifiés pour la stabilité
const GAME_WIDTH = 1500;
const GAME_HEIGHT = 1500;
const FOOD_COUNT = 75;
const RUG_COUNT = 5;
const FOOD_SIZE = 5;
const RUG_SIZE = 40;
const FOOD_VALUE = 1;
const RUG_PENALTY = 5;
const SUPABASE_UPDATE_INTERVAL = 500; // Réduit la fréquence des mises à jour

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
  const [gameOverCalled, setGameOverCalled] = useState(false);
  const { toast } = useToast();

  const playerRef = useRef(currentPlayer);
  const gameLoopRef = useRef<number | null>(null);
  const gameIdRef = useRef<string | null>(null);
  const lastUpdateTimeRef = useRef<number>(0);
  const isInitializedRef = useRef<boolean>(false);
  const animationFrameRef = useRef<number | null>(null);

  // Initialisation - simplifiée
  useEffect(() => {
    if (!currentRoom || currentRoom?.status !== 'playing' || !currentPlayer || isInitializedRef.current) return;
    isInitializedRef.current = true;
    
    // Initialize players with random positions
    const initialPlayers = currentRoom.players.map(p => ({
      ...p,
      x: Math.random() * (GAME_WIDTH - 100) + 50,
      y: Math.random() * (GAME_HEIGHT - 100) + 50,
      isAlive: true,
      size: 15 // Taille de départ réduite pour plus de stabilité
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
      
      // Update player position in Supabase - moins fréquemment
      try {
        updatePlayerPosition(currentRoom.id, ourPlayer);
      } catch (error) {
        console.log("Erreur de mise à jour initiale, ignorée:", error);
      }
      
      // Center camera on player
      setCameraPosition({ x: ourPlayer.x, y: ourPlayer.y });
    }
    
    // Réduit les souscriptions Supabase pour améliorer la stabilité
    const channel = supabase
      .channel('game-updates')
      .on('postgres_changes', 
        { event: 'UPDATE', schema: 'public', table: 'room_players', filter: `room_id=eq.${currentRoom.id}` }, 
        (payload) => {
          if (payload.new && payload.new.player_id !== currentPlayer.id) {
            try {
              updatePlayerFromSupabase(payload.new);
            } catch (error) {
              console.log("Erreur de mise à jour, ignorée:", error);
            }
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
      isInitializedRef.current = false;
      if (gameLoopRef.current) {
        cancelAnimationFrame(gameLoopRef.current);
        gameLoopRef.current = null;
      }
      
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      
      try {
        if (channel) {
          supabase.removeChannel(channel);
        }
      } catch (error) {
        console.log("Erreur lors du nettoyage, ignorée:", error);
      }
    };
  }, [currentRoom, currentPlayer, toast]);

  // Simplifier les mises à jour - seulement les données essentielles
  const updatePlayerFromSupabase = (newPlayerData: any) => {
    setPlayers(prevPlayers => {
      return prevPlayers.map(p => {
        if (p.id === newPlayerData.player_id) {
          return {
            ...p,
            size: newPlayerData.size || p.size,
            x: newPlayerData.x || p.x,
            y: newPlayerData.y || p.y,
            isAlive: newPlayerData.is_alive !== undefined ? newPlayerData.is_alive : p.isAlive
          };
        }
        return p;
      });
    });
  };

  // Mise à jour Supabase optimisée et avec gestion d'erreur
  const updatePlayerPosition = async (roomId: string, player: Player) => {
    if (!player || !roomId) return;
    
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
      // On ignore les erreurs pour maintenir la stabilité
      console.log("Erreur de mise à jour ignorée:", error);
    }
  };

  // Mouse movement - simplifié
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

  // Game loop - optimisé
  useEffect(() => {
    if (!currentRoom || !currentPlayer || currentRoom?.status !== 'playing') return;
    
    const ourPlayer = players.find(p => p.id === currentPlayer.id);
    if (!ourPlayer || !ourPlayer.isAlive) return;
    
    const gameLoop = (timestamp: number) => {
      // Throttle Supabase updates
      const shouldUpdate = timestamp - lastUpdateTimeRef.current > SUPABASE_UPDATE_INTERVAL;
      
      setPlayers(prevPlayers => {
        if (prevPlayers.length === 0) return prevPlayers;
        
        const ourPlayerIndex = prevPlayers.findIndex(p => p.id === currentPlayer.id);
        if (ourPlayerIndex === -1 || !prevPlayers[ourPlayerIndex].isAlive) {
          return prevPlayers;
        }
        
        const updatedPlayers = [...prevPlayers];
        const me = updatedPlayers[ourPlayerIndex];
        
        // Calculate movement direction - simplifié
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
          
          // Vitesse plus lente pour les grands blobs, plus rapide pour les petits
          const speedFactor = Math.max(0.5, 3 / Math.sqrt(me.size));
          const speed = 2 * speedFactor;
          
          if (distance > 5) {
            me.x += (dx / distance) * speed;
            me.y += (dy / distance) * speed;
            
            // Limites du jeu
            me.x = Math.max(me.size, Math.min(GAME_WIDTH - me.size, me.x));
            me.y = Math.max(me.size, Math.min(GAME_HEIGHT - me.size, me.y));
          }
        }
        
        // Check collisions with food - simplifié
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
        
        // Check collisions with rugs - simplifié
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
        
        // Check collisions with other players - simplifié
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
              // If similar size, bounce off each other
              const angle = Math.atan2(dy, dx);
              const pushDistance = 5;
              me.x += Math.cos(angle) * pushDistance;
              me.y += Math.sin(angle) * pushDistance;
            }
          }
        }
        
        // Update camera position to follow player - zoom limité pour éviter le plein écran
        setCameraPosition({ x: me.x, y: me.y });
        
        // Limiter le zoom pour éviter les problèmes
        const maxSize = 50; // Taille maximum à considérer pour le zoom
        const effectiveSize = Math.min(me.size, maxSize);
        setCameraZoom(Math.max(0.5, Math.min(1.5, 20 / Math.sqrt(effectiveSize))));
        
        // Send player position to Supabase if enough time has passed
        if (shouldUpdate && currentRoom) {
          lastUpdateTimeRef.current = timestamp;
          try {
            updatePlayerPosition(currentRoom.id, me);
          } catch (error) {
            console.log("Erreur de mise à jour ignorée:", error);
          }
        }
        
        // Check if game over - simplifié
        const alivePlayers = updatedPlayers.filter(p => p.isAlive);
        const isSoloMode = currentRoom.maxPlayers === 1 && updatedPlayers.length === 1;
        
        if (!isSoloMode && !gameOverCalled && updatedPlayers.length > 1 && alivePlayers.length <= 1) {
          const winner = alivePlayers.length === 1 ? alivePlayers[0] : null;
          setGameOverCalled(true);
          
          try {
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
          } catch (error) {
            console.log("Erreur lors de la fin de partie:", error);
            onGameOver(winner); // On termine quand même la partie
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
  }, [currentRoom, currentPlayer, cameraZoom, cameraPosition, mousePosition, players, onGameOver, toast]);

  // Rendering - complètement optimisé
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    // Taille du canvas basée sur le conteneur
    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
    };
    
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    
    // Dessin optimisé
    const renderCanvas = () => {
      const context = canvas.getContext('2d');
      if (!context) return;
      
      // Clear canvas
      context.clearRect(0, 0, canvas.width, canvas.height);
      
      // Transform for camera position and zoom
      context.save();
      context.translate(canvas.width / 2, canvas.height / 2);
      context.scale(cameraZoom, cameraZoom);
      context.translate(-cameraPosition.x, -cameraPosition.y);
      
      // Draw game bounds
      context.beginPath();
      context.strokeStyle = '#000';
      context.lineWidth = 2 / cameraZoom;
      context.strokeRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
      
      // Draw grid - plus simple
      context.beginPath();
      context.strokeStyle = '#eee';
      context.lineWidth = 1 / cameraZoom;
      
      const gridSize = 100; // Plus grand = moins de lignes
      for (let x = 0; x <= GAME_WIDTH; x += gridSize) {
        context.moveTo(x, 0);
        context.lineTo(x, GAME_HEIGHT);
      }
      
      for (let y = 0; y <= GAME_HEIGHT; y += gridSize) {
        context.moveTo(0, y);
        context.lineTo(GAME_WIDTH, y);
      }
      
      context.stroke();
      
      // Draw food - simplifié
      foods.forEach(food => {
        context.beginPath();
        context.fillStyle = '#2ecc71';
        context.arc(food.x, food.y, food.size, 0, Math.PI * 2);
        context.fill();
      });
      
      // Draw rugs - simplifié
      rugs.forEach(rug => {
        context.beginPath();
        context.fillStyle = '#8e44ad';
        context.arc(rug.x, rug.y, rug.size, 0, Math.PI * 2);
        context.fill();
      });
      
      // Draw players - simplifié
      players.forEach(player => {
        if (!player.isAlive) return;
        
        // Dessin simple pour les blobs
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
      
      // Boucle d'animation optimisée
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

  // Helper function to get color hex - simplifié
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
