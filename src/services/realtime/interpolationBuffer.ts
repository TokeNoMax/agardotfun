
export interface PositionSnapshot {
  x: number;
  y: number;
  r: number;
  timestamp: number;
}

export interface InterpolatedBlob {
  id: string;
  currentX: number;
  currentY: number;
  currentR: number;
  targetX: number;
  targetY: number;
  targetR: number;
  lastUpdate: number;
  snapshots: PositionSnapshot[];
}

export class InterpolationBuffer {
  private blobs = new Map<string, InterpolatedBlob>();
  private maxSnapshots = 3;
  private interpolationDelay = 100; // 100ms de délai pour smooth interpolation
  
  // Ajouter une nouvelle position reçue du serveur
  addPosition(id: string, x: number, y: number, r: number, timestamp?: number) {
    const now = timestamp || Date.now();
    
    if (!this.blobs.has(id)) {
      this.blobs.set(id, {
        id,
        currentX: x,
        currentY: y,
        currentR: r,
        targetX: x,
        targetY: y,
        targetR: r,
        lastUpdate: now,
        snapshots: []
      });
    }
    
    const blob = this.blobs.get(id)!;
    
    // Ajouter le snapshot
    blob.snapshots.push({ x, y, r, timestamp: now });
    
    // Garder seulement les derniers snapshots
    if (blob.snapshots.length > this.maxSnapshots) {
      blob.snapshots.shift();
    }
    
    // Mettre à jour les targets
    blob.targetX = x;
    blob.targetY = y;
    blob.targetR = r;
    blob.lastUpdate = now;
  }
  
  // Interpoler toutes les positions à 60 FPS
  interpolateAll(deltaTime: number): Map<string, { x: number; y: number; r: number }> {
    const result = new Map();
    const now = Date.now();
    
    for (const [id, blob] of this.blobs) {
      // Facteur d'interpolation basé sur le deltaTime
      const timeSinceUpdate = now - blob.lastUpdate;
      let alpha = Math.min(1, deltaTime / 16.67); // Normaliser pour 60 FPS
      
      // Si trop de temps s'est écoulé, interpoler plus agressivement
      if (timeSinceUpdate > 200) {
        alpha = Math.min(1, alpha * 2);
      }
      
      // Prédiction basée sur les snapshots précédents
      const predicted = this.predictPosition(blob, deltaTime);
      
      // Interpolation linéaire vers la position prédite
      blob.currentX = this.lerp(blob.currentX, predicted.x, alpha);
      blob.currentY = this.lerp(blob.currentY, predicted.y, alpha);
      blob.currentR = this.lerp(blob.currentR, predicted.r, alpha * 0.5); // Size change plus lent
      
      result.set(id, {
        x: blob.currentX,
        y: blob.currentY,
        r: blob.currentR
      });
    }
    
    return result;
  }
  
  // Prédiction de position basée sur la vélocité
  private predictPosition(blob: InterpolatedBlob, deltaTime: number): { x: number; y: number; r: number } {
    if (blob.snapshots.length < 2) {
      return { x: blob.targetX, y: blob.targetY, r: blob.targetR };
    }
    
    const latest = blob.snapshots[blob.snapshots.length - 1];
    const previous = blob.snapshots[blob.snapshots.length - 2];
    
    const timeDiff = latest.timestamp - previous.timestamp;
    if (timeDiff <= 0) {
      return { x: blob.targetX, y: blob.targetY, r: blob.targetR };
    }
    
    // Calculer la vélocité
    const velocityX = (latest.x - previous.x) / timeDiff;
    const velocityY = (latest.y - previous.y) / timeDiff;
    
    // Prédire la position future
    const prediction = deltaTime / 1000; // Convertir en secondes
    
    return {
      x: blob.targetX + (velocityX * prediction * 1000),
      y: blob.targetY + (velocityY * prediction * 1000),
      r: blob.targetR
    };
  }
  
  // Interpolation linéaire
  private lerp(start: number, end: number, factor: number): number {
    return start + (end - start) * factor;
  }
  
  // Nettoyer les blobs inactifs
  cleanup(maxAge: number = 5000) {
    const now = Date.now();
    for (const [id, blob] of this.blobs) {
      if (now - blob.lastUpdate > maxAge) {
        this.blobs.delete(id);
      }
    }
  }
  
  // Obtenir un blob spécifique
  getBlob(id: string): InterpolatedBlob | undefined {
    return this.blobs.get(id);
  }
  
  // Supprimer un blob
  removeBlob(id: string) {
    this.blobs.delete(id);
  }
  
  // Obtenir tous les IDs actifs
  getActiveIds(): string[] {
    return Array.from(this.blobs.keys());
  }
}
