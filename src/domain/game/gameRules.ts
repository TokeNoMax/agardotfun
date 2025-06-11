
/**
 * Pure business logic for game rules and mechanics
 * No React dependencies - pure functions only
 */

export interface GameConfig {
  maxPlayers: number;
  mapWidth: number;
  mapHeight: number;
  initialPlayerSize: number;
  minPlayerSize: number;
  maxPlayerSize: number;
  foodSpawnRate: number;
  safeZoneConfig?: SafeZoneConfig;
}

export interface SafeZoneConfig {
  initialRadius: number;
  shrinkInterval: number; // milliseconds
  shrinkPercentage: number; // 0-1
  damagePerSecond: number;
  centerX: number;
  centerY: number;
}

/**
 * Default game configurations for different modes
 */
export const GAME_CONFIGS: Record<string, GameConfig> = {
  classic: {
    maxPlayers: 10,
    mapWidth: 3000,
    mapHeight: 3000,
    initialPlayerSize: 20,
    minPlayerSize: 10,
    maxPlayerSize: 1000,
    foodSpawnRate: 0.1
  },
  battle_royale: {
    maxPlayers: 20,
    mapWidth: 3000,
    mapHeight: 3000,
    initialPlayerSize: 25,
    minPlayerSize: 10,
    maxPlayerSize: 2000,
    foodSpawnRate: 0.15,
    safeZoneConfig: {
      initialRadius: 1000,
      shrinkInterval: 120000, // 2 minutes
      shrinkPercentage: 0.2,
      damagePerSecond: 1,
      centerX: 1500,
      centerY: 1500
    }
  },
  local: {
    maxPlayers: 1,
    mapWidth: 2000,
    mapHeight: 1500,
    initialPlayerSize: 20,
    minPlayerSize: 10,
    maxPlayerSize: 500,
    foodSpawnRate: 0.2
  }
};

/**
 * Check if a player can absorb another player
 * @param absorberSize Size of the absorbing player
 * @param targetSize Size of the target player
 * @param threshold Minimum size ratio required for absorption
 * @returns Whether absorption is possible
 */
export function canAbsorbPlayer(
  absorberSize: number,
  targetSize: number,
  threshold: number = 1.1
): boolean {
  if (absorberSize <= 0 || targetSize <= 0) {
    return false;
  }
  
  return absorberSize / targetSize >= threshold;
}

/**
 * Check if a player is within the safe zone
 * @param playerX Player X coordinate
 * @param playerY Player Y coordinate
 * @param safeZone Safe zone configuration
 * @returns Whether player is within safe zone
 */
export function isPlayerInSafeZone(
  playerX: number,
  playerY: number,
  safeZone: { x: number; y: number; currentRadius: number }
): boolean {
  const distance = Math.sqrt(
    Math.pow(playerX - safeZone.x, 2) + Math.pow(playerY - safeZone.y, 2)
  );
  return distance <= safeZone.currentRadius;
}

/**
 * Calculate damage from being outside safe zone
 * @param playerSize Current player size
 * @param damagePerSecond Damage rate per second
 * @param deltaTime Time elapsed in seconds
 * @returns New player size after damage
 */
export function applyZoneDamage(
  playerSize: number,
  damagePerSecond: number,
  deltaTime: number
): number {
  if (playerSize <= 0 || damagePerSecond <= 0 || deltaTime <= 0) {
    return playerSize;
  }
  
  const damage = damagePerSecond * deltaTime;
  return Math.max(0, playerSize - damage);
}

/**
 * Calculate food spawn positions
 * @param mapWidth Map width
 * @param mapHeight Map height
 * @param existingFood Current food positions
 * @param spawnRate Spawn rate (0-1)
 * @returns Array of new food positions
 */
export function calculateFoodSpawns(
  mapWidth: number,
  mapHeight: number,
  existingFoodCount: number,
  spawnRate: number,
  maxFood: number = 200
): Array<{ x: number; y: number; size: number }> {
  if (existingFoodCount >= maxFood) {
    return [];
  }
  
  const shouldSpawn = Math.random() < spawnRate;
  if (!shouldSpawn) {
    return [];
  }
  
  const spawnsToCreate = Math.floor(Math.random() * 3) + 1; // 1-3 spawns
  const spawns: Array<{ x: number; y: number; size: number }> = [];
  
  for (let i = 0; i < spawnsToCreate && existingFoodCount + spawns.length < maxFood; i++) {
    spawns.push({
      x: Math.random() * mapWidth,
      y: Math.random() * mapHeight,
      size: Math.random() * 3 + 2 // Size between 2-5
    });
  }
  
  return spawns;
}

/**
 * Check if game should end
 * @param players Array of active players
 * @param gameMode Game mode
 * @param gameDuration Game duration in milliseconds
 * @returns Game end result
 */
export function checkGameEndCondition(
  players: Array<{ isAlive: boolean; id: string; size: number }>,
  gameMode: string,
  gameDuration: number
): {
  shouldEnd: boolean;
  winner: { id: string; size: number } | null;
  reason: 'last_player' | 'time_limit' | 'size_limit' | null;
} {
  const alivePlayers = players.filter(p => p.isAlive);
  
  // Check for last player standing
  if (alivePlayers.length <= 1) {
    return {
      shouldEnd: true,
      winner: alivePlayers[0] || null,
      reason: 'last_player'
    };
  }
  
  // Check time limits for different modes
  const timeLimit = gameMode === 'battle_royale' ? 600000 : 1800000; // 10min vs 30min
  if (gameDuration >= timeLimit) {
    // Find largest player
    const winner = alivePlayers.reduce((largest, current) => 
      current.size > largest.size ? current : largest
    );
    
    return {
      shouldEnd: true,
      winner,
      reason: 'time_limit'
    };
  }
  
  // Check size limits
  const maxSizePlayer = alivePlayers.find(p => p.size >= GAME_CONFIGS[gameMode]?.maxPlayerSize);
  if (maxSizePlayer) {
    return {
      shouldEnd: true,
      winner: maxSizePlayer,
      reason: 'size_limit'
    };
  }
  
  return {
    shouldEnd: false,
    winner: null,
    reason: null
  };
}

/**
 * Calculate optimal spawn position for new player
 * @param mapWidth Map width
 * @param mapHeight Map height
 * @param existingPlayers Current player positions
 * @param minDistance Minimum distance from other players
 * @returns Spawn position
 */
export function calculateSpawnPosition(
  mapWidth: number,
  mapHeight: number,
  existingPlayers: Array<{ x: number; y: number; size: number }>,
  minDistance: number = 200
): { x: number; y: number } {
  const maxAttempts = 50;
  let attempts = 0;
  
  while (attempts < maxAttempts) {
    const x = Math.random() * mapWidth;
    const y = Math.random() * mapHeight;
    
    // Check distance from existing players
    const tooClose = existingPlayers.some(player => {
      const distance = Math.sqrt(
        Math.pow(x - player.x, 2) + Math.pow(y - player.y, 2)
      );
      return distance < minDistance + player.size;
    });
    
    if (!tooClose) {
      return { x, y };
    }
    
    attempts++;
  }
  
  // Fallback: random position
  return {
    x: Math.random() * mapWidth,
    y: Math.random() * mapHeight
  };
}
