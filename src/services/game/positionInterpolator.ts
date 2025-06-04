export interface InterpolatedPosition {
  x: number;
  y: number;
  size: number;
  velocityX: number;
  velocityY: number;
}

export interface PositionSnapshot {
  position: InterpolatedPosition;
  timestamp: number;
}

export class PositionInterpolator {
  private snapshots: PositionSnapshot[] = [];
  private maxSnapshots = 3;

  addSnapshot(position: InterpolatedPosition): void {
    const snapshot: PositionSnapshot = {
      position: { ...position },
      timestamp: Date.now()
    };

    this.snapshots.push(snapshot);
    
    // Keep only the last few snapshots
    if (this.snapshots.length > this.maxSnapshots) {
      this.snapshots.shift();
    }
  }

  interpolate(targetPosition: InterpolatedPosition, deltaTime: number): InterpolatedPosition {
    if (this.snapshots.length < 2) {
      return targetPosition;
    }

    const latest = this.snapshots[this.snapshots.length - 1];
    const previous = this.snapshots[this.snapshots.length - 2];
    
    // Calculate time difference
    const timeDiff = latest.timestamp - previous.timestamp;
    if (timeDiff <= 0) return targetPosition;

    // Calculate interpolation factor (smooth movement)
    const alpha = Math.min(1, deltaTime / 100); // 100ms target
    
    // Linear interpolation with velocity prediction
    const predicted = this.predictPosition(latest.position, deltaTime);
    
    return {
      x: this.lerp(latest.position.x, predicted.x, alpha),
      y: this.lerp(latest.position.y, predicted.y, alpha),
      size: this.lerp(latest.position.size, targetPosition.size, alpha),
      velocityX: targetPosition.velocityX,
      velocityY: targetPosition.velocityY
    };
  }

  private predictPosition(position: InterpolatedPosition, deltaTime: number): InterpolatedPosition {
    const timeFactor = deltaTime / 16.67; // 60fps reference
    
    return {
      ...position,
      x: position.x + (position.velocityX * timeFactor),
      y: position.y + (position.velocityY * timeFactor)
    };
  }

  private lerp(start: number, end: number, factor: number): number {
    return start + (end - start) * factor;
  }

  clear(): void {
    this.snapshots = [];
  }
}
