
export interface PositionValidation {
  isValid: boolean;
  reason?: string;
  correctedPosition?: { x: number; y: number };
}

export class PositionValidator {
  private static readonly MAX_SPEED = 10; // pixels per frame at 60fps
  private static readonly WORLD_BOUNDS = {
    minX: 0,
    maxX: 3000,
    minY: 0,
    maxY: 3000
  };
  private static readonly MAX_SIZE = 200;
  private static readonly MIN_SIZE = 5;

  static validatePosition(
    newX: number,
    newY: number,
    newSize: number,
    lastX: number,
    lastY: number,
    lastTimestamp: number,
    currentTimestamp: number
  ): PositionValidation {
    // Validate bounds
    if (newX < this.WORLD_BOUNDS.minX || newX > this.WORLD_BOUNDS.maxX ||
        newY < this.WORLD_BOUNDS.minY || newY > this.WORLD_BOUNDS.maxY) {
      return {
        isValid: false,
        reason: 'Position out of world bounds',
        correctedPosition: {
          x: Math.max(this.WORLD_BOUNDS.minX, Math.min(this.WORLD_BOUNDS.maxX, newX)),
          y: Math.max(this.WORLD_BOUNDS.minY, Math.min(this.WORLD_BOUNDS.maxY, newY))
        }
      };
    }

    // Validate size
    if (newSize < this.MIN_SIZE || newSize > this.MAX_SIZE) {
      return {
        isValid: false,
        reason: 'Invalid player size'
      };
    }

    // Validate speed (prevent teleportation)
    const timeDelta = Math.max(1, currentTimestamp - lastTimestamp);
    const distance = Math.sqrt(Math.pow(newX - lastX, 2) + Math.pow(newY - lastY, 2));
    const speed = distance / (timeDelta / 1000); // pixels per second

    if (speed > this.MAX_SPEED * 60) { // Convert to pixels per second
      return {
        isValid: false,
        reason: 'Movement too fast (possible teleportation)'
      };
    }

    return { isValid: true };
  }

  static validateCollision(
    player1: { x: number; y: number; size: number },
    player2: { x: number; y: number; size: number }
  ): boolean {
    const distance = Math.sqrt(
      Math.pow(player1.x - player2.x, 2) + Math.pow(player1.y - player2.y, 2)
    );
    
    const combinedRadius = (player1.size + player2.size) / 2;
    return distance <= combinedRadius;
  }

  static sanitizePlayerData(data: any): any {
    return {
      x: Math.round(Number(data.x) || 0),
      y: Math.round(Number(data.y) || 0),
      size: Math.round(Number(data.size) || 15),
      velocityX: Math.max(-this.MAX_SPEED, Math.min(this.MAX_SPEED, Number(data.velocityX) || 0)),
      velocityY: Math.max(-this.MAX_SPEED, Math.min(this.MAX_SPEED, Number(data.velocityY) || 0))
    };
  }
}
