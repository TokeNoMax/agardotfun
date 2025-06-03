
// Déterministic map generation service using seeds
export interface MapSeed {
  roomId: string;
  seed: string;
  timestamp: number;
}

export interface GeneratedMap {
  foods: Array<{ id: string; x: number; y: number; size: number }>;
  rugs: Array<{ id: string; x: number; y: number; size: number }>;
  spawnPoints: Array<{ x: number; y: number }>;
}

// Simple seeded random number generator (Linear Congruential Generator)
class SeededRandom {
  private seed: number;

  constructor(seed: string) {
    // Convert string seed to number
    this.seed = this.hashCode(seed) % 2147483647;
    if (this.seed <= 0) this.seed += 2147483646;
  }

  private hashCode(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }

  next(): number {
    this.seed = (this.seed * 16807) % 2147483647;
    return (this.seed - 1) / 2147483646;
  }
}

export class MapGenerator {
  private static readonly GAME_WIDTH = 3000;
  private static readonly GAME_HEIGHT = 3000;
  private static readonly FOOD_COUNT = 150;
  private static readonly RUG_COUNT = 10;
  private static readonly FOOD_SIZE = 5;
  private static readonly RUG_SIZE = 40;
  private static readonly MAX_PLAYERS = 8;

  static generateSeed(roomId: string): string {
    return `${roomId}_${Date.now()}_${Math.random().toString(36).substring(2)}`;
  }

  static generateMap(seed: string): GeneratedMap {
    const rng = new SeededRandom(seed);
    console.log("Generating map with seed:", seed);

    // Generate foods
    const foods = Array(this.FOOD_COUNT).fill(0).map((_, index) => ({
      id: `food_${seed}_${index}`,
      x: rng.next() * this.GAME_WIDTH,
      y: rng.next() * this.GAME_HEIGHT,
      size: this.FOOD_SIZE
    }));

    // Generate rugs  
    const rugs = Array(this.RUG_COUNT).fill(0).map((_, index) => ({
      id: `rug_${seed}_${index}`,
      x: rng.next() * this.GAME_WIDTH,
      y: rng.next() * this.GAME_HEIGHT,
      size: this.RUG_SIZE
    }));

    // Generate fixed spawn points in a circle pattern
    const spawnPoints = Array(this.MAX_PLAYERS).fill(0).map((_, index) => {
      const angle = (index / this.MAX_PLAYERS) * 2 * Math.PI;
      const radius = 300; // Distance from center
      const centerX = this.GAME_WIDTH / 2;
      const centerY = this.GAME_HEIGHT / 2;
      
      return {
        x: centerX + Math.cos(angle) * radius,
        y: centerY + Math.sin(angle) * radius
      };
    });

    console.log(`Generated map: ${foods.length} foods, ${rugs.length} rugs, ${spawnPoints.length} spawn points`);
    
    return { foods, rugs, spawnPoints };
  }

  static getSpawnPoint(spawnPoints: Array<{ x: number; y: number }>, playerIndex: number): { x: number; y: number } {
    if (playerIndex < spawnPoints.length) {
      return spawnPoints[playerIndex];
    }
    
    // Fallback to center if too many players
    return {
      x: this.GAME_WIDTH / 2,
      y: this.GAME_HEIGHT / 2
    };
  }
}
