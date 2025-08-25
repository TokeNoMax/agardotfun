/**
 * Client-side gameplay validation service
 * Prevents basic tampering and provides security diagnostics
 */

export interface SecurityViolation {
  type: 'speed_hack' | 'position_teleport' | 'size_manipulation' | 'input_flooding' | 'impossible_action';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  timestamp: number;
  data?: any;
}

export interface PlayerState {
  x: number;
  y: number;
  size: number;
  velocityX?: number;
  velocityY?: number;
  timestamp: number;
}

export class GameplayValidator {
  private playerHistory: Map<string, PlayerState[]> = new Map();
  private violations: SecurityViolation[] = [];
  private inputCounts: Map<string, number> = new Map();
  private lastInputReset = Date.now();
  
  // Security thresholds
  private readonly MAX_SPEED = 150; // pixels per second
  private readonly MAX_POSITION_JUMP = 100; // pixels
  private readonly MAX_SIZE_CHANGE = 20; // per update
  private readonly MAX_INPUTS_PER_SECOND = 30;
  private readonly HISTORY_LENGTH = 10;

  /**
   * Validate player movement for speed hacking
   */
  validateMovement(playerId: string, newState: PlayerState, deltaTime: number): boolean {
    const history = this.playerHistory.get(playerId) || [];
    
    if (history.length === 0) {
      this.addPlayerState(playerId, newState);
      return true;
    }

    const lastState = history[history.length - 1];
    const timeDiff = (newState.timestamp - lastState.timestamp) / 1000;
    
    // Skip validation if time difference is too small or large
    if (timeDiff < 0.016 || timeDiff > 1) {
      this.addPlayerState(playerId, newState);
      return true;
    }

    // Calculate actual movement distance
    const dx = newState.x - lastState.x;
    const dy = newState.y - lastState.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const speed = distance / timeDiff;

    // Speed validation with size-based adjustments
    const sizeMultiplier = Math.max(0.2, 1 - (newState.size - 20) / 180);
    const maxAllowedSpeed = this.MAX_SPEED * sizeMultiplier;

    if (speed > maxAllowedSpeed * 1.5) { // 50% tolerance
      this.addViolation({
        type: 'speed_hack',
        severity: 'high',
        description: `Player ${playerId} exceeded maximum speed: ${speed.toFixed(2)} > ${maxAllowedSpeed.toFixed(2)}`,
        timestamp: Date.now(),
        data: { speed, maxAllowed: maxAllowedSpeed, position: newState }
      });
      return false;
    }

    // Position teleportation check
    if (distance > this.MAX_POSITION_JUMP && timeDiff < 0.1) {
      this.addViolation({
        type: 'position_teleport',
        severity: 'critical',
        description: `Player ${playerId} teleported: ${distance.toFixed(2)} pixels in ${timeDiff.toFixed(3)}s`,
        timestamp: Date.now(),
        data: { distance, timeDiff, from: lastState, to: newState }
      });
      return false;
    }

    this.addPlayerState(playerId, newState);
    return true;
  }

  /**
   * Validate size changes for manipulation
   */
  validateSizeChange(playerId: string, oldSize: number, newSize: number, reason?: string): boolean {
    const sizeDiff = Math.abs(newSize - oldSize);
    
    // Allow normal food consumption and collisions
    if (reason === 'food' && sizeDiff <= 5) return true;
    if (reason === 'collision' && newSize > oldSize) return true;
    
    // Check for impossible size changes
    if (sizeDiff > this.MAX_SIZE_CHANGE) {
      this.addViolation({
        type: 'size_manipulation',
        severity: 'high',
        description: `Player ${playerId} had impossible size change: ${oldSize} -> ${newSize} (${reason || 'unknown'})`,
        timestamp: Date.now(),
        data: { oldSize, newSize, reason, diff: sizeDiff }
      });
      return false;
    }

    return true;
  }

  /**
   * Validate input rate to prevent flooding
   */
  validateInputRate(playerId: string): boolean {
    const now = Date.now();
    
    // Reset counters every second
    if (now - this.lastInputReset > 1000) {
      this.inputCounts.clear();
      this.lastInputReset = now;
    }

    const currentCount = this.inputCounts.get(playerId) || 0;
    this.inputCounts.set(playerId, currentCount + 1);

    if (currentCount > this.MAX_INPUTS_PER_SECOND) {
      this.addViolation({
        type: 'input_flooding',
        severity: 'medium',
        description: `Player ${playerId} sending too many inputs: ${currentCount}/s`,
        timestamp: now,
        data: { inputsPerSecond: currentCount }
      });
      return false;
    }

    return true;
  }

  /**
   * Validate collision detection integrity
   */
  validateCollision(player1: PlayerState, player2: PlayerState): boolean {
    const dx = player1.x - player2.x;
    const dy = player1.y - player2.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const minDistance = (player1.size + player2.size) / 2;

    // Check if collision is physically possible
    if (distance > minDistance * 1.2) {
      this.addViolation({
        type: 'impossible_action',
        severity: 'high',
        description: `Collision reported with insufficient proximity: ${distance.toFixed(2)} > ${minDistance.toFixed(2)}`,
        timestamp: Date.now(),
        data: { distance, minDistance, player1, player2 }
      });
      return false;
    }

    return true;
  }

  /**
   * Get security status and violations
   */
  getSecurityReport(): {
    violations: SecurityViolation[];
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    playerStats: Map<string, any>;
  } {
    const recentViolations = this.violations.filter(v => Date.now() - v.timestamp < 60000); // Last minute
    
    let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';
    
    const criticalCount = recentViolations.filter(v => v.severity === 'critical').length;
    const highCount = recentViolations.filter(v => v.severity === 'high').length;
    
    if (criticalCount > 0) riskLevel = 'critical';
    else if (highCount > 2) riskLevel = 'high';
    else if (recentViolations.length > 5) riskLevel = 'medium';

    const playerStats = new Map();
    this.playerHistory.forEach((history, playerId) => {
      if (history.length > 0) {
        const latest = history[history.length - 1];
        playerStats.set(playerId, {
          position: { x: latest.x, y: latest.y },
          size: latest.size,
          historyLength: history.length,
          violations: this.violations.filter(v => v.description.includes(playerId)).length
        });
      }
    });

    return {
      violations: recentViolations,
      riskLevel,
      playerStats
    };
  }

  /**
   * Clean up old data
   */
  cleanup(): void {
    const cutoff = Date.now() - 300000; // 5 minutes
    
    // Clean violations
    this.violations = this.violations.filter(v => v.timestamp > cutoff);
    
    // Clean player history
    this.playerHistory.forEach((history, playerId) => {
      const filtered = history.filter(state => state.timestamp > cutoff);
      if (filtered.length === 0) {
        this.playerHistory.delete(playerId);
      } else {
        this.playerHistory.set(playerId, filtered);
      }
    });
  }

  private addPlayerState(playerId: string, state: PlayerState): void {
    const history = this.playerHistory.get(playerId) || [];
    history.push(state);
    
    // Keep only recent history
    if (history.length > this.HISTORY_LENGTH) {
      history.shift();
    }
    
    this.playerHistory.set(playerId, history);
  }

  private addViolation(violation: SecurityViolation): void {
    this.violations.push(violation);
    console.warn('🚨 Security Violation:', violation);
    
    // Keep only recent violations
    if (this.violations.length > 100) {
      this.violations.shift();
    }
  }

  /**
   * Reset validator state (for new games)
   */
  reset(): void {
    this.playerHistory.clear();
    this.violations = [];
    this.inputCounts.clear();
    this.lastInputReset = Date.now();
  }
}

// Global instance for the game
export const gameplayValidator = new GameplayValidator();
