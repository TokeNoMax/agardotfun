
interface PredictedState {
  x: number;
  y: number;
  size: number;
  velocityX: number;
  velocityY: number;
  timestamp: number;
  inputSeq: number;
}

interface InputRecord {
  seq: number;
  timestamp: number;
  moveX: number;
  moveY: number;
  boost?: boolean;
}

export class ClientPredictionService {
  private predictedStates: PredictedState[] = [];
  private inputHistory: InputRecord[] = [];
  private lastServerState: PredictedState | null = null;
  private currentState: PredictedState;
  private readonly MAX_PREDICTION_TIME = 200; // 200ms
  private readonly MAX_HISTORY = 60; // ~1 second at 60fps

  constructor(initialState: { x: number; y: number; size: number }) {
    this.currentState = {
      x: initialState.x,
      y: initialState.y,
      size: initialState.size,
      velocityX: 0,
      velocityY: 0,
      timestamp: Date.now(),
      inputSeq: 0
    };
  }

  // Apply input locally for immediate response
  applyInput(input: InputRecord, deltaTime: number): PredictedState {
    const speed = this.calculateSpeed(this.currentState.size);
    
    // Update velocity based on input
    this.currentState.velocityX = input.moveX * speed;
    this.currentState.velocityY = input.moveY * speed;

    // Update position
    this.currentState.x += this.currentState.velocityX * deltaTime;
    this.currentState.y += this.currentState.velocityY * deltaTime;

    // Apply boundaries
    this.applyBoundaries();

    // Apply friction
    this.currentState.velocityX *= 0.95;
    this.currentState.velocityY *= 0.95;

    this.currentState.timestamp = input.timestamp;
    this.currentState.inputSeq = input.seq;

    // Store prediction
    this.predictedStates.push({ ...this.currentState });
    this.inputHistory.push(input);

    // Cleanup old data
    this.cleanup();

    return { ...this.currentState };
  }

  // Reconcile with server state
  reconcileWithServer(serverState: {
    x: number;
    y: number;
    size: number;
    velocityX?: number;
    velocityY?: number;
    timestamp: number;
    lastInputSeq?: number;
  }): PredictedState {
    this.lastServerState = {
      x: serverState.x,
      y: serverState.y,
      size: serverState.size,
      velocityX: serverState.velocityX || 0,
      velocityY: serverState.velocityY || 0,
      timestamp: serverState.timestamp,
      inputSeq: serverState.lastInputSeq || 0
    };

    // Find the prediction that corresponds to the server state
    const serverInputSeq = serverState.lastInputSeq || 0;
    const predictionIndex = this.predictedStates.findIndex(
      state => state.inputSeq === serverInputSeq
    );

    if (predictionIndex === -1) {
      // No matching prediction, accept server state
      this.currentState = { ...this.lastServerState };
      this.predictedStates = [];
      return { ...this.currentState };
    }

    const prediction = this.predictedStates[predictionIndex];
    const positionError = Math.sqrt(
      Math.pow(prediction.x - serverState.x, 2) + 
      Math.pow(prediction.y - serverState.y, 2)
    );

    // If error is significant, apply correction
    if (positionError > 5) { // 5 pixel threshold
      console.log(`[ClientPrediction] Correcting position error: ${positionError.toFixed(2)}px`);
      
      // Smoothly interpolate to server position
      const correctionFactor = Math.min(1, positionError / 20);
      this.currentState.x = this.lerp(prediction.x, serverState.x, correctionFactor);
      this.currentState.y = this.lerp(prediction.y, serverState.y, correctionFactor);
      this.currentState.size = serverState.size;
      
      // Re-apply inputs that came after the server state
      this.reapplyInputs(predictionIndex + 1);
    } else {
      // Prediction was accurate, just update size (server authoritative)
      this.currentState.size = serverState.size;
    }

    // Remove old predictions
    this.predictedStates = this.predictedStates.slice(predictionIndex + 1);
    this.inputHistory = this.inputHistory.filter(
      input => input.seq > serverInputSeq
    );

    return { ...this.currentState };
  }

  private reapplyInputs(startIndex: number): void {
    const inputsToReapply = this.inputHistory.filter(
      (_, index) => index >= startIndex
    );

    for (const input of inputsToReapply) {
      const deltaTime = 1/60; // Assume 60fps for re-simulation
      this.applyInput(input, deltaTime);
    }
  }

  private calculateSpeed(size: number): number {
    const baseSpeed = 200; // pixels per second
    const sizeMultiplier = Math.max(0.3, 1 - (size - 20) / 200);
    return baseSpeed * sizeMultiplier;
  }

  private applyBoundaries(): void {
    const mapWidth = 2000;
    const mapHeight = 2000;
    const radius = this.currentState.size / 2;

    if (this.currentState.x - radius < 0) {
      this.currentState.x = radius;
      this.currentState.velocityX = 0;
    }
    if (this.currentState.x + radius > mapWidth) {
      this.currentState.x = mapWidth - radius;
      this.currentState.velocityX = 0;
    }
    if (this.currentState.y - radius < 0) {
      this.currentState.y = radius;
      this.currentState.velocityY = 0;
    }
    if (this.currentState.y + radius > mapHeight) {
      this.currentState.y = mapHeight - radius;
      this.currentState.velocityY = 0;
    }
  }

  private cleanup(): void {
    const now = Date.now();
    
    // Remove old predictions
    this.predictedStates = this.predictedStates.filter(
      state => now - state.timestamp < this.MAX_PREDICTION_TIME
    );

    if (this.predictedStates.length > this.MAX_HISTORY) {
      this.predictedStates = this.predictedStates.slice(-this.MAX_HISTORY);
    }

    // Remove old inputs
    this.inputHistory = this.inputHistory.filter(
      input => now - input.timestamp < this.MAX_PREDICTION_TIME
    );

    if (this.inputHistory.length > this.MAX_HISTORY) {
      this.inputHistory = this.inputHistory.slice(-this.MAX_HISTORY);
    }
  }

  private lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
  }

  getCurrentState(): PredictedState {
    return { ...this.currentState };
  }

  getNetworkStats() {
    return {
      predictedStates: this.predictedStates.length,
      inputHistory: this.inputHistory.length,
      lastServerTimestamp: this.lastServerState?.timestamp,
      currentTimestamp: this.currentState.timestamp,
      lag: this.lastServerState ? Date.now() - this.lastServerState.timestamp : 0
    };
  }
}
