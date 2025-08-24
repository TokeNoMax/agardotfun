import { Player, PlayerInput, Food, GameState, RoomState } from '../types/game';
import { v4 as uuidv4 } from 'uuid';

interface CompactInput {
  t: number;  // timestamp
  seq: number; // sequence
  dx: number;  // moveX (-1 to 1)
  dy: number;  // moveY (-1 to 1)
  act?: number; // actions bitmask (boost=1, split=2, feed=4)
}

interface SpatialCell {
  players: Set<string>;
  foods: Set<string>;
}

export class OptimizedGameEngine {
  private readonly TICK_RATE = 20; // Increased to 20Hz (50ms per tick)
  private readonly MAP_WIDTH = 2000;
  private readonly MAP_HEIGHT = 2000;
  private readonly BASE_SPEED = 100;
  private readonly FOOD_COUNT = 500;
  
  // Spatial optimization
  private readonly CELL_SIZE = 256; // AOI cell size
  private readonly CELLS_X = Math.ceil(this.MAP_WIDTH / this.CELL_SIZE);
  private readonly CELLS_Y = Math.ceil(this.MAP_HEIGHT / this.CELL_SIZE);
  private spatialGrid: SpatialCell[][] = [];

  // Performance tracking
  private lastTickTime = 0;
  private avgTickTime = 0;
  private tickCount = 0;

  constructor() {
    this.initializeSpatialGrid();
  }

  private initializeSpatialGrid(): void {
    for (let x = 0; x < this.CELLS_X; x++) {
      this.spatialGrid[x] = [];
      for (let y = 0; y < this.CELLS_Y; y++) {
        this.spatialGrid[x][y] = {
          players: new Set(),
          foods: new Set()
        };
      }
    }
  }

  initializeRoom(roomId: string): RoomState {
    const foods: Record<string, Food> = {};
    
    // Generate initial food with spatial indexing
    for (let i = 0; i < this.FOOD_COUNT; i++) {
      const food: Food = {
        id: uuidv4(),
        x: Math.random() * this.MAP_WIDTH,
        y: Math.random() * this.MAP_HEIGHT,
        size: Math.random() > 0.9 ? 8 : 4,
        type: Math.random() > 0.9 ? 'big' : 'normal'
      };
      foods[food.id] = food;
      this.addToSpatialGrid(food, 'food');
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
    this.addToSpatialGrid(player, 'player');
    
    return player;
  }

  removePlayer(roomState: RoomState, playerId: string): void {
    const player = roomState.players[playerId];
    if (player) {
      this.removeFromSpatialGrid(player, 'player');
    }
    delete roomState.players[playerId];
    delete roomState.gameState.players[playerId];
  }

  processPlayerInput(roomState: RoomState, playerId: string, input: PlayerInput | CompactInput): void {
    const player = roomState.players[playerId];
    if (!player || !player.isAlive) return;

    // Handle both formats (legacy and optimized)
    let processedInput: PlayerInput;
    if ('dx' in input) {
      // Convert compact format to standard format
      processedInput = {
        seq: input.seq,
        timestamp: input.t,
        moveX: Math.max(-1, Math.min(1, input.dx)), // Clamp to [-1, 1]
        moveY: Math.max(-1, Math.min(1, input.dy)), // Clamp to [-1, 1]
        boost: !!(input.act && input.act & 1)
      };
    } else {
      processedInput = input as PlayerInput;
      // Validate and clamp standard input
      processedInput.moveX = Math.max(-1, Math.min(1, processedInput.moveX));
      processedInput.moveY = Math.max(-1, Math.min(1, processedInput.moveY));
    }

    // Input validation: Check sequence number and cooldown
    if (processedInput.seq <= player.lastInputSeq) return;
    
    // Store input in buffer for client prediction validation
    player.inputBuffer.push(processedInput);
    
    // Keep only last 20 inputs for validation (increased buffer)
    if (player.inputBuffer.length > 20) {
      player.inputBuffer.shift();
    }

    player.lastInputSeq = processedInput.seq;

    // Apply input immediately (server authoritative)
    const speed = this.calculatePlayerSpeed(player);
    const newVelocityX = processedInput.moveX * speed;
    const newVelocityY = processedInput.moveY * speed;
    
    // Velocity validation: ensure magnitude doesn't exceed max speed
    const magnitude = Math.sqrt(newVelocityX * newVelocityX + newVelocityY * newVelocityY);
    if (magnitude > speed) {
      const normalizer = speed / magnitude;
      player.velocityX = newVelocityX * normalizer;
      player.velocityY = newVelocityY * normalizer;
    } else {
      player.velocityX = newVelocityX;
      player.velocityY = newVelocityY;
    }
  }

  update(roomState: RoomState, deltaTime: number): void {
    const tickStart = Date.now();
    
    roomState.tickCount++;
    roomState.gameState.tick = roomState.tickCount;
    roomState.gameState.timestamp = Date.now();
    roomState.gameState.collisions = [];

    // Update all players and spatial indexing
    for (const player of Object.values(roomState.players)) {
      if (!player.isAlive) continue;
      
      this.removeFromSpatialGrid(player, 'player');
      this.updatePlayerPosition(player, deltaTime);
      this.checkBoundaries(player);
      this.addToSpatialGrid(player, 'player');
    }

    // Optimized collision detection using spatial grid
    this.checkFoodCollisionsSpatial(roomState);
    this.checkPlayerCollisionsSpatial(roomState);

    // Spawn new food
    this.spawnFood(roomState);

    // Performance tracking
    const tickTime = Date.now() - tickStart;
    this.tickCount++;
    this.avgTickTime = (this.avgTickTime * (this.tickCount - 1) + tickTime) / this.tickCount;
    this.lastTickTime = tickTime;
  }

  private addToSpatialGrid(entity: Player | Food, type: 'player' | 'food'): void {
    const cellX = Math.floor(entity.x / this.CELL_SIZE);
    const cellY = Math.floor(entity.y / this.CELL_SIZE);
    
    if (cellX >= 0 && cellX < this.CELLS_X && cellY >= 0 && cellY < this.CELLS_Y) {
      this.spatialGrid[cellX][cellY][type === 'player' ? 'players' : 'foods'].add(entity.id);
    }
  }

  private removeFromSpatialGrid(entity: Player | Food, type: 'player' | 'food'): void {
    // Remove from all cells (entity might have moved)
    for (let x = 0; x < this.CELLS_X; x++) {
      for (let y = 0; y < this.CELLS_Y; y++) {
        this.spatialGrid[x][y][type === 'player' ? 'players' : 'foods'].delete(entity.id);
      }
    }
  }

  private getNearbyEntities(x: number, y: number, radius = 1): { players: Set<string>, foods: Set<string> } {
    const cellX = Math.floor(x / this.CELL_SIZE);
    const cellY = Math.floor(y / this.CELL_SIZE);
    
    const players = new Set<string>();
    const foods = new Set<string>();
    
    // Check surrounding cells
    for (let dx = -radius; dx <= radius; dx++) {
      for (let dy = -radius; dy <= radius; dy++) {
        const checkX = cellX + dx;
        const checkY = cellY + dy;
        
        if (checkX >= 0 && checkX < this.CELLS_X && checkY >= 0 && checkY < this.CELLS_Y) {
          const cell = this.spatialGrid[checkX][checkY];
          cell.players.forEach(id => players.add(id));
          cell.foods.forEach(id => foods.add(id));
        }
      }
    }
    
    return { players, foods };
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

  private checkFoodCollisionsSpatial(roomState: RoomState): void {
    for (const player of Object.values(roomState.players)) {
      if (!player.isAlive) continue;

      const nearby = this.getNearbyEntities(player.x, player.y, 1);
      
      for (const foodId of nearby.foods) {
        const food = roomState.foods[foodId];
        if (!food) continue;

        const distance = Math.sqrt(
          Math.pow(player.x - food.x, 2) + Math.pow(player.y - food.y, 2)
        );

        if (distance < (player.size / 2) + (food.size / 2)) {
          // Consume food
          player.size += food.size * 0.1;
          this.removeFromSpatialGrid(food, 'food');
          delete roomState.foods[foodId];
          delete roomState.gameState.foods[foodId];
        }
      }
    }
  }

  private checkPlayerCollisionsSpatial(roomState: RoomState): void {
    const processedPairs = new Set<string>();
    
    for (const player1 of Object.values(roomState.players)) {
      if (!player1.isAlive) continue;

      const nearby = this.getNearbyEntities(player1.x, player1.y, 1);
      
      for (const player2Id of nearby.players) {
        if (player2Id === player1.id) continue;
        
        const pairKey = [player1.id, player2Id].sort().join('-');
        if (processedPairs.has(pairKey)) continue;
        processedPairs.add(pairKey);
        
        const player2 = roomState.players[player2Id];
        if (!player2 || !player2.isAlive) continue;

        const distance = Math.sqrt(
          Math.pow(player1.x - player2.x, 2) + Math.pow(player1.y - player2.y, 2)
        );

        const minDistance = (player1.size + player2.size) / 2;

        if (distance < minDistance) {
          // Determine who gets eliminated (1.1x size advantage required)
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

          // Remove eliminated player from spatial grid
          this.removeFromSpatialGrid(eliminated, 'player');

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
      const foodsToSpawn = Math.min(10, this.FOOD_COUNT - currentFoodCount); // Increased spawn rate
      
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
        this.addToSpatialGrid(food, 'food');
      }
    }
  }

  private calculatePlayerSpeed(player: Player): number {
    // Speed decreases as size increases (more aggressive scaling)
    const sizeMultiplier = Math.max(0.2, 1 - (player.size - 20) / 180);
    return this.BASE_SPEED * sizeMultiplier;
  }

  getGameState(roomState: RoomState): GameState {
    return { ...roomState.gameState };
  }

  // Interest management: Get entities within player's Area of Interest
  getPlayerAOI(playerId: string, roomState: RoomState): { players: Record<string, Player>, foods: Record<string, Food> } {
    const player = roomState.players[playerId];
    if (!player) return { players: {}, foods: {} };

    // 3x3 cell radius around player
    const nearby = this.getNearbyEntities(player.x, player.y, 3);
    
    const aoiPlayers: Record<string, Player> = {};
    const aoiFoods: Record<string, Food> = {};
    
    // Add nearby players
    for (const nearbyPlayerId of nearby.players) {
      const nearbyPlayer = roomState.players[nearbyPlayerId];
      if (nearbyPlayer && nearbyPlayer.isAlive) {
        aoiPlayers[nearbyPlayerId] = nearbyPlayer;
      }
    }
    
    // Add nearby foods
    for (const nearbyFoodId of nearby.foods) {
      const nearbyFood = roomState.foods[nearbyFoodId];
      if (nearbyFood) {
        aoiFoods[nearbyFoodId] = nearbyFood;
      }
    }
    
    return { players: aoiPlayers, foods: aoiFoods };
  }

  // Performance diagnostics
  getDiagnostics() {
    return {
      tickRate: this.TICK_RATE,
      lastTickTime: this.lastTickTime,
      avgTickTime: this.avgTickTime,
      tickCount: this.tickCount,
      spatialCells: this.CELLS_X * this.CELLS_Y,
      cellSize: this.CELL_SIZE
    };
  }
}
