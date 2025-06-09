
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
  private maxSnapshots = 5; // Increased for 50Hz
  private targetFrameTime = 20; // 50Hz = 20ms

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

    // Optimized interpolation factor for 50Hz
    const alpha = Math.min(1, deltaTime / this.targetFrameTime);
    
    // Enhanced prediction for higher frequency updates
    const predicted = this.predictPosition(latest.position, deltaTime);
    
    // Smoother interpolation with velocity consideration
    const velocityFactor = Math.min(1, Math.sqrt(
      Math.pow(latest.position.velocityX, 2) + Math.pow(latest.position.velocityY, 2)
    ) / 100);
    
    const adaptiveAlpha = alpha * (0.8 + velocityFactor * 0.2);
    
    return {
      x: this.smoothLerp(latest.position.x, predicted.x, adaptiveAlpha),
      y: this.smoothLerp(latest.position.y, predicted.y, adaptiveAlpha),
      size: this.lerp(latest.position.size, targetPosition.size, alpha * 0.5), // Slower size changes
      velocityX: targetPosition.velocityX,
      velocityY: targetPosition.velocityY
    };
  }

  private predictPosition(position: InterpolatedPosition, deltaTime: number): InterpolatedPosition {
    // More accurate prediction for 50Hz updates
    const timeFactor = deltaTime / this.targetFrameTime;
    
    return {
      ...position,
      x: position.x + (position.velocityX * timeFactor * 0.8), // Slightly conservative prediction
      y: position.y + (position.velocityY * timeFactor * 0.8)
    };
  }

  private lerp(start: number, end: number, factor: number): number {
    return start + (end - start) * factor;
  }

  private smoothLerp(start: number, end: number, factor: number): number {
    // Smooth step function for more natural movement at 50Hz
    const smoothFactor = factor * factor * (3 - 2 * factor);
    return start + (end - start) * smoothFactor;
  }

  clear(): void {
    this.snapshots = [];
  }

  // Get diagnostic information for 50Hz performance
  getDiagnostics() {
    return {
      snapshotCount: this.snapshots.length,
      targetFrameTime: this.targetFrameTime,
      frequency: '50Hz',
      lastUpdate: this.snapshots.length > 0 ? this.snapshots[this.snapshots.length - 1].timestamp : 0
    };
  }
}
