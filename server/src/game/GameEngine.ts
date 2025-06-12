import { Player, PlayerInput, Food, GameState, RoomState } from '../types/game';
import { v4 as uuidv4 } from 'uuid';

export class GameEngine {
  private readonly TICK_RATE = 15; // 66ms per tick
  private readonly MAP_WIDTH = 2000;
  private readonly MAP_HEIGHT = 2000;
  private readonly BASE_SPEED = 100;
  private readonly FOOD_COUNT = 500;

  constructor() {}

  initializeRoom(roomId: string): RoomState {
    const foods: Record<string, Food> = {};
    
    // Generate initial food
    for (let i = 0; i < this.FOOD_COUNT; i++) {
      const food: Food = {
        id: uuidv4(),
        x: Math.random() * this.MAP_WIDTH,
        y: Math.random() * this.MAP_HEIGHT,
        size: Math.random() > 0.9 ? 8 : 4,
        type: Math.random() > 0.9 ? 'big' : 'normal'
      };
      foods[food.id] = food;
    }

    return {
      id: roomId,
      players: {},
      foods,
      gameState: {
        tick: 0,
        timestamp: Date.now(),
        players: {},
        foods,
        collisions: []
      },
      lastSnapshot: null,
      tickCount: 0
    };
  }

  addPlayer(roomState: RoomState, playerId: string, name: string, color: string): Player {
    const player: Player = {
      id: playerId,
      name,
      color,
      x: Math.random() * this.MAP_WIDTH,
      y: Math.random() * this.MAP_HEIGHT,
      size: 20,
      velocityX: 0,
      velocityY: 0,
      isAlive: true,
      lastInputSeq: 0,
      inputBuffer: []
    };

    roomState.players[playerId] = player;
    roomState.gameState.players[playerId] = player;
    
    return player;
  }

  removePlayer(roomState: RoomState, playerId: string): void {
    delete roomState.players[playerId];
    delete roomState.gameState.players[playerId];
  }

  processPlayerInput(roomState: RoomState, playerId: string, input: PlayerInput): void {
    const player = roomState.players[playerId];
    if (!player || !player.isAlive) return;

    // Store input in buffer for client prediction validation
    player.inputBuffer.push(input);
    
    // Keep only last 10 inputs for validation
    if (player.inputBuffer.length > 10) {
      player.inputBuffer.shift();
    }

    player.lastInputSeq = input.seq;

    // Apply input immediately (server authoritative)
    const speed = this.calculatePlayerSpeed(player);
    player.velocityX = input.moveX * speed;
    player.velocityY = input.moveY * speed;
  }

  update(roomState: RoomState, deltaTime: number): void {
    roomState.tickCount++;
    roomState.gameState.tick = roomState.tickCount;
    roomState.gameState.timestamp = Date.now();
    roomState.gameState.collisions = [];

    // Update all players
    for (const player of Object.values(roomState.players)) {
      if (!player.isAlive) continue;
      
      this.updatePlayerPosition(player, deltaTime);
      this.checkBoundaries(player);
    }

    // Check food consumption
    this.checkFoodCollisions(roomState);

    // Check player collisions
    this.checkPlayerCollisions(roomState);

    // Spawn new food
    this.spawnFood(roomState);
  }

  private updatePlayerPosition(player: Player, deltaTime: number): void {
    player.x += player.velocityX * deltaTime;
    player.y += player.velocityY * deltaTime;

    // Apply friction
    player.velocityX *= 0.95;
    player.velocityY *= 0.95;
  }

  private checkBoundaries(player: Player): void {
    const radius = player.size / 2;
    
    if (player.x - radius < 0) {
      player.x = radius;
      player.velocityX = 0;
    }
    if (player.x + radius > this.MAP_WIDTH) {
      player.x = this.MAP_WIDTH - radius;
      player.velocityX = 0;
    }
    if (player.y - radius < 0) {
      player.y = radius;
      player.velocityY = 0;
    }
    if (player.y + radius > this.MAP_HEIGHT) {
      player.y = this.MAP_HEIGHT - radius;
      player.velocityY = 0;
    }
  }

  private checkFoodCollisions(roomState: RoomState): void {
    for (const player of Object.values(roomState.players)) {
      if (!player.isAlive) continue;

      for (const [foodId, food] of Object.entries(roomState.foods)) {
        const distance = Math.sqrt(
          Math.pow(player.x - food.x, 2) + Math.pow(player.y - food.y, 2)
        );

        if (distance < (player.size / 2) + (food.size / 2)) {
          // Consume food
          player.size += food.size * 0.1;
          delete roomState.foods[foodId];
          delete roomState.gameState.foods[foodId];
        }
      }
    }
  }

  private checkPlayerCollisions(roomState: RoomState): void {
    const players = Object.values(roomState.players).filter(p => p.isAlive);
    
    for (let i = 0; i < players.length; i++) {
      for (let j = i + 1; j < players.length; j++) {
        const player1 = players[i];
        const player2 = players[j];

        const distance = Math.sqrt(
          Math.pow(player1.x - player2.x, 2) + Math.pow(player1.y - player2.y, 2)
        );

        const minDistance = (player1.size + player2.size) / 2;

        if (distance < minDistance) {
          // Determine who gets eliminated
          let eliminator, eliminated;
          
          if (player1.size > player2.size * 1.1) {
            eliminator = player1;
            eliminated = player2;
          } else if (player2.size > player1.size * 1.1) {
            eliminator = player2;
            eliminated = player1;
          } else {
            continue; // No elimination if sizes are too close
          }

          // Apply collision
          eliminated.isAlive = false;
          eliminator.size += eliminated.size * 0.8;

          roomState.gameState.collisions.push({
            eliminatedId: eliminated.id,
            eliminatorId: eliminator.id,
            timestamp: Date.now()
          });
        }
      }
    }
  }

  private spawnFood(roomState: RoomState): void {
    const currentFoodCount = Object.keys(roomState.foods).length;
    
    if (currentFoodCount < this.FOOD_COUNT) {
      const foodsToSpawn = Math.min(5, this.FOOD_COUNT - currentFoodCount);
      
      for (let i = 0; i < foodsToSpawn; i++) {
        const food: Food = {
          id: uuidv4(),
          x: Math.random() * this.MAP_WIDTH,
          y: Math.random() * this.MAP_HEIGHT,
          size: Math.random() > 0.9 ? 8 : 4,
          type: Math.random() > 0.9 ? 'big' : 'normal'
        };
        
        roomState.foods[food.id] = food;
        roomState.gameState.foods[food.id] = food;
      }
    }
  }

  private calculatePlayerSpeed(player: Player): number {
    // Speed decreases as size increases
    const sizeMultiplier = Math.max(0.3, 1 - (player.size - 20) / 200);
    return this.BASE_SPEED * sizeMultiplier;
  }

  getGameState(roomState: RoomState): GameState {
    return { ...roomState.gameState };
  }
}
