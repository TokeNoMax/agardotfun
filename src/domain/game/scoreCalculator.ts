
/**
 * Pure business logic for score calculations
 * No React dependencies - pure functions only
 */

export interface ScoreCalculation {
  newSize: number;
  absorptionRate: number;
  sizeIncrease: number;
}

/**
 * Calculate new size after absorption
 * @param winnerSize Current size of the winner
 * @param loserSize Current size of the loser
 * @param absorptionRate Rate of absorption (0-1)
 * @returns New calculated size
 */
export function calculateAbsorption(
  winnerSize: number,
  loserSize: number,
  absorptionRate: number = 0.8
): ScoreCalculation {
  if (winnerSize <= 0 || loserSize <= 0) {
    throw new Error('Sizes must be positive numbers');
  }
  
  if (absorptionRate < 0 || absorptionRate > 1) {
    throw new Error('Absorption rate must be between 0 and 1');
  }

  const sizeIncrease = loserSize * absorptionRate;
  const newSize = winnerSize + sizeIncrease;

  return {
    newSize,
    absorptionRate,
    sizeIncrease
  };
}

/**
 * Calculate food consumption bonus
 * @param currentSize Current player size
 * @param foodSize Size of the food consumed
 * @returns New size after food consumption
 */
export function calculateFoodConsumption(
  currentSize: number,
  foodSize: number
): number {
  if (currentSize <= 0 || foodSize <= 0) {
    throw new Error('Sizes must be positive numbers');
  }

  return currentSize + foodSize;
}

/**
 * Calculate score based on survival time and final size
 * @param survivalTime Time survived in milliseconds
 * @param finalSize Final size achieved
 * @param gameMode Type of game mode
 * @returns Calculated score
 */
export function calculateFinalScore(
  survivalTime: number,
  finalSize: number,
  gameMode: 'classic' | 'battle_royale' | 'local' = 'classic'
): number {
  if (survivalTime < 0 || finalSize < 0) {
    throw new Error('Survival time and final size must be non-negative');
  }

  const timeBonus = Math.floor(survivalTime / 1000) * 10; // 10 points per second
  const sizeBonus = Math.floor(finalSize) * 5; // 5 points per size unit
  
  // Mode multipliers
  const modeMultiplier = gameMode === 'battle_royale' ? 1.5 : 1.0;
  
  return Math.floor((timeBonus + sizeBonus) * modeMultiplier);
}

/**
 * Determine if a collision should result in absorption
 * @param size1 Size of first player
 * @param size2 Size of second player
 * @param threshold Minimum size difference ratio for absorption
 * @returns Object indicating which player wins and if absorption occurs
 */
export function determineCollisionOutcome(
  size1: number,
  size2: number,
  threshold: number = 1.1
): {
  shouldAbsorb: boolean;
  winnerId: 1 | 2 | null;
  sizeDifference: number;
} {
  if (size1 <= 0 || size2 <= 0) {
    throw new Error('Sizes must be positive numbers');
  }

  const sizeDifference = Math.abs(size1 - size2);
  const largerSize = Math.max(size1, size2);
  const smallerSize = Math.min(size1, size2);
  
  const sizeRatio = largerSize / smallerSize;
  const shouldAbsorb = sizeRatio >= threshold;
  
  let winnerId: 1 | 2 | null = null;
  if (shouldAbsorb) {
    winnerId = size1 > size2 ? 1 : 2;
  }

  return {
    shouldAbsorb,
    winnerId,
    sizeDifference
  };
}
