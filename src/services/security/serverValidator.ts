/**
 * Server-side validation hooks for critical game actions
 * This ensures all critical actions are validated by the server
 */

export interface ValidationResult {
  valid: boolean;
  reason?: string;
  correctedValue?: any;
}

export interface ServerValidationConfig {
  enableInputValidation: boolean;
  enablePositionValidation: boolean;
  enableCollisionValidation: boolean;
  enableSizeValidation: boolean;
  strictMode: boolean;
}

export class ServerValidator {
  private config: ServerValidationConfig;
  private playerStates: Map<string, any> = new Map();
  private lastValidationTime = Date.now();

  constructor(config: Partial<ServerValidationConfig> = {}) {
    this.config = {
      enableInputValidation: true,
      enablePositionValidation: true,
      enableCollisionValidation: true,
      enableSizeValidation: true,
      strictMode: false,
      ...config
    };
  }

  /**
   * Validate player input before sending to server
   */
  validatePlayerInput(input: {
    moveX: number;
    moveY: number;
    boost?: boolean;
    timestamp: number;
    playerId: string;
  }): ValidationResult {
    if (!this.config.enableInputValidation) {
      return { valid: true };
    }

    // Normalize movement vector
    const magnitude = Math.sqrt(input.moveX * input.moveX + input.moveY * input.moveY);
    if (magnitude > 1.01) { // Small tolerance for floating point errors
      return {
        valid: false,
        reason: 'Movement vector magnitude exceeds 1.0',
        correctedValue: {
          moveX: input.moveX / magnitude,
          moveY: input.moveY / magnitude
        }
      };
    }

    // Validate timestamp
    const now = Date.now();
    if (Math.abs(input.timestamp - now) > 5000) { // 5 second tolerance
      return {
        valid: false,
        reason: 'Timestamp out of acceptable range',
        correctedValue: { timestamp: now }
      };
    }

    // Rate limiting check
    const lastState = this.playerStates.get(input.playerId);
    if (lastState && lastState.lastInputTime) {
      const timeDiff = input.timestamp - lastState.lastInputTime;
      if (timeDiff < 16) { // Minimum 16ms between inputs (60Hz max)
        return {
          valid: false,
          reason: 'Input rate too high'
        };
      }
    }

    // Update player state
    this.playerStates.set(input.playerId, {
      ...lastState,
      lastInputTime: input.timestamp,
      lastInput: input
    });

    return { valid: true };
  }

  /**
   * Validate position updates from server
   */
  validatePositionUpdate(update: {
    playerId: string;
    x: number;
    y: number;
    size: number;
    timestamp: number;
  }): ValidationResult {
    if (!this.config.enablePositionValidation) {
      return { valid: true };
    }

    const lastState = this.playerStates.get(update.playerId);
    
    if (!lastState) {
      // First position update for this player
      this.playerStates.set(update.playerId, {
        position: { x: update.x, y: update.y },
        size: update.size,
        timestamp: update.timestamp
      });
      return { valid: true };
    }

    const timeDiff = (update.timestamp - lastState.timestamp) / 1000;
    
    if (timeDiff > 0) {
      // Calculate maximum possible movement
      const dx = update.x - lastState.position.x;
      const dy = update.y - lastState.position.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const speed = distance / timeDiff;
      
      // Size-adjusted max speed (matches server calculation)
      const sizeMultiplier = Math.max(0.2, 1 - (update.size - 20) / 180);
      const maxSpeed = 100 * sizeMultiplier; // BASE_SPEED = 100
      
      if (speed > maxSpeed * 1.2) { // 20% tolerance
        console.warn(`Position validation failed for ${update.playerId}: speed ${speed.toFixed(2)} > ${maxSpeed.toFixed(2)}`);
        
        if (this.config.strictMode) {
          return {
            valid: false,
            reason: 'Position change exceeds maximum possible speed'
          };
        }
      }
    }

    // Update state
    this.playerStates.set(update.playerId, {
      position: { x: update.x, y: update.y },
      size: update.size,
      timestamp: update.timestamp
    });

    return { valid: true };
  }

  /**
   * Validate collision events
   */
  validateCollision(collision: {
    eliminatedId: string;
    eliminatorId: string;
    eliminatedSize: number;
    eliminatorNewSize: number;
  }): ValidationResult {
    if (!this.config.enableCollisionValidation) {
      return { valid: true };
    }

    const eliminatedState = this.playerStates.get(collision.eliminatedId);
    const eliminatorState = this.playerStates.get(collision.eliminatorId);

    if (!eliminatedState || !eliminatorState) {
      return {
        valid: false,
        reason: 'Player states not found for collision validation'
      };
    }

    // Check size advantage (eliminator must be at least 1.1x larger)
    const sizeRatio = eliminatorState.size / eliminatedState.size;
    if (sizeRatio < 1.05) { // Slight tolerance
      return {
        valid: false,
        reason: `Insufficient size advantage for elimination: ${sizeRatio.toFixed(2)}`
      };
    }

    // Check proximity
    const dx = eliminatorState.position.x - eliminatedState.position.x;
    const dy = eliminatorState.position.y - eliminatedState.position.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const minDistance = (eliminatorState.size + eliminatedState.size) / 2;

    if (distance > minDistance * 1.1) { // 10% tolerance
      return {
        valid: false,
        reason: `Players too far apart for collision: ${distance.toFixed(2)} > ${minDistance.toFixed(2)}`
      };
    }

    // Validate size gain (should be 80% of eliminated player's size)
    const expectedNewSize = eliminatorState.size + (eliminatedState.size * 0.8);
    const sizeDifference = Math.abs(collision.eliminatorNewSize - expectedNewSize);
    
    if (sizeDifference > 2) { // Small tolerance
      return {
        valid: false,
        reason: `Invalid size gain: expected ${expectedNewSize.toFixed(2)}, got ${collision.eliminatorNewSize}`,
        correctedValue: { eliminatorNewSize: expectedNewSize }
      };
    }

    return { valid: true };
  }

  /**
   * Validate food consumption
   */
  validateFoodConsumption(consumption: {
    playerId: string;
    foodId: string;
    playerSize: number;
    newPlayerSize: number;
    foodSize: number;
  }): ValidationResult {
    if (!this.config.enableSizeValidation) {
      return { valid: true };
    }

    // Expected size gain (10% of food size)
    const expectedGain = consumption.foodSize * 0.1;
    const actualGain = consumption.newPlayerSize - consumption.playerSize;
    
    if (Math.abs(actualGain - expectedGain) > 0.5) {
      return {
        valid: false,
        reason: `Invalid food consumption gain: expected ${expectedGain.toFixed(2)}, got ${actualGain.toFixed(2)}`,
        correctedValue: { newPlayerSize: consumption.playerSize + expectedGain }
      };
    }

    return { valid: true };
  }

  /**
   * Get validation statistics
   */
  getValidationStats(): {
    totalValidations: number;
    failedValidations: number;
    playerCount: number;
    config: ServerValidationConfig;
  } {
    return {
      totalValidations: this.playerStates.size,
      failedValidations: 0, // Would need to track this
      playerCount: this.playerStates.size,
      config: this.config
    };
  }

  /**
   * Clean up old player states
   */
  cleanup(): void {
    const cutoff = Date.now() - 60000; // 1 minute
    
    for (const [playerId, state] of this.playerStates.entries()) {
      if (state.timestamp < cutoff) {
        this.playerStates.delete(playerId);
      }
    }
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<ServerValidationConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Reset validator state
   */
  reset(): void {
    this.playerStates.clear();
    this.lastValidationTime = Date.now();
  }
}

// Global instance
export const serverValidator = new ServerValidator();