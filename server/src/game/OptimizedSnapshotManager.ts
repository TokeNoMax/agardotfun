import { GameState, GameSnapshot, Player, Food } from '../types/game';

interface CompactSnapshot {
  t: number; // timestamp
  tick: number;
  you?: CompactPlayer; // Current player data
  ps?: Record<string, CompactPlayer>; // players: {id: [x,y,r,c]}
  fs?: Record<string, CompactFood>; // foods: {id: [x,y,r]}
  rm?: string[]; // removed entity IDs
  cols?: Array<{ e: string, r: string }>; // collisions: eliminated, eliminator
}

interface CompactPlayer {
  x: number;
  y: number;
  r: number; // radius (size)
  c?: string; // color (only if changed)
  n?: string; // name (only if changed)
  alive?: boolean; // only if changed
}

interface CompactFood {
  x: number;
  y: number;
  r: number; // radius (size)
  t?: 'big' | 'normal'; // type (only if changed)
}

interface ClientState {
  lastAckTick: number;
  lastSnapshot: GameSnapshot | null;
  knownPlayers: Set<string>;
  knownFoods: Set<string>;
}

export class OptimizedSnapshotManager {
  private clientStates: Map<string, ClientState> = new Map();
  private lastSnapshot: GameSnapshot | null = null;
  private compressionEnabled = false;

  createSnapshot(currentState: GameState): GameSnapshot {
    const snapshot: GameSnapshot = {
      tick: currentState.tick,
      timestamp: currentState.timestamp,
      delta: {
        players: {},
        foods: {
          added: {},
          removed: []
        },
        collisions: currentState.collisions.map(col => ({
          eliminatedId: col.eliminatedId,
          eliminatorId: col.eliminatorId
        }))
      }
    };

    // Compare with last snapshot to create delta
    if (this.lastSnapshot) {
      // Find changed/new players
      for (const [playerId, player] of Object.entries(currentState.players)) {
        const lastPlayer = this.lastSnapshot.delta.players[playerId];
        if (!lastPlayer || this.hasPlayerChanged(player, lastPlayer)) {
          snapshot.delta.players[playerId] = this.getPlayerDelta(player, lastPlayer);
        }
      }

      // Find removed players
      for (const playerId of Object.keys(this.lastSnapshot.delta.players)) {
        if (!currentState.players[playerId]) {
          // Player was removed - this will be handled by absence in new snapshot
        }
      }

      // Find new/changed foods
      for (const [foodId, food] of Object.entries(currentState.foods)) {
        const wasKnown = this.lastSnapshot.delta.foods.added[foodId];
        if (!wasKnown) {
          snapshot.delta.foods.added[foodId] = food;
        }
      }

      // Find removed foods
      const currentFoodIds = new Set(Object.keys(currentState.foods));
      for (const foodId of Object.keys(this.lastSnapshot.delta.foods.added)) {
        if (!currentFoodIds.has(foodId)) {
          snapshot.delta.foods.removed.push(foodId);
        }
      }
    } else {
      // First snapshot - include everything
      snapshot.delta.players = { ...currentState.players };
      snapshot.delta.foods.added = { ...currentState.foods };
    }

    this.lastSnapshot = snapshot;
    return snapshot;
  }

  // Create optimized snapshot for specific client with AOI
  createClientSnapshot(
    playerId: string, 
    currentState: GameState, 
    aoiPlayers: Record<string, Player>,
    aoiFoods: Record<string, Food>
  ): CompactSnapshot | GameSnapshot {
    let clientState = this.clientStates.get(playerId);
    if (!clientState) {
      clientState = {
        lastAckTick: 0,
        lastSnapshot: null,
        knownPlayers: new Set(),
        knownFoods: new Set()
      };
      this.clientStates.set(playerId, clientState);
    }

    const snapshot: CompactSnapshot = {
      t: currentState.timestamp,
      tick: currentState.tick
    };

    // Add current player data
    const currentPlayer = aoiPlayers[playerId];
    if (currentPlayer) {
      snapshot.you = {
        x: Math.round(currentPlayer.x * 10) / 10, // 1 decimal precision
        y: Math.round(currentPlayer.y * 10) / 10,
        r: Math.round(currentPlayer.size * 10) / 10
      };
    }

    // Add other players in AOI (delta compressed)
    const changedPlayers: Record<string, CompactPlayer> = {};
    const removedEntities: string[] = [];

    for (const [otherPlayerId, player] of Object.entries(aoiPlayers)) {
      if (otherPlayerId === playerId) continue; // Skip self
      
      const wasKnown = clientState.knownPlayers.has(otherPlayerId);
      const hasChanged = !wasKnown || this.hasPlayerChangedCompact(player, clientState.lastSnapshot, otherPlayerId);
      
      if (hasChanged) {
        changedPlayers[otherPlayerId] = {
          x: Math.round(player.x * 10) / 10,
          y: Math.round(player.y * 10) / 10,
          r: Math.round(player.size * 10) / 10,
          ...((!wasKnown || !player.isAlive) && { alive: player.isAlive }),
          ...(!wasKnown && { c: player.color, n: player.name })
        };
        clientState.knownPlayers.add(otherPlayerId);
      }
    }

    // Find players that left AOI
    for (const knownPlayerId of clientState.knownPlayers) {
      if (!aoiPlayers[knownPlayerId] && knownPlayerId !== playerId) {
        removedEntities.push(knownPlayerId);
        clientState.knownPlayers.delete(knownPlayerId);
      }
    }

    // Add foods in AOI (delta compressed)
    const changedFoods: Record<string, CompactFood> = {};
    
    for (const [foodId, food] of Object.entries(aoiFoods)) {
      const wasKnown = clientState.knownFoods.has(foodId);
      
      if (!wasKnown) {
        changedFoods[foodId] = {
          x: Math.round(food.x * 10) / 10,
          y: Math.round(food.y * 10) / 10,
          r: food.size,
          t: food.type
        };
        clientState.knownFoods.add(foodId);
      }
    }

    // Find foods that left AOI
    for (const knownFoodId of clientState.knownFoods) {
      if (!aoiFoods[knownFoodId]) {
        removedEntities.push(knownFoodId);
        clientState.knownFoods.delete(knownFoodId);
      }
    }

    // Only include non-empty sections
    if (Object.keys(changedPlayers).length > 0) {
      snapshot.ps = changedPlayers;
    }
    if (Object.keys(changedFoods).length > 0) {
      snapshot.fs = changedFoods;
    }
    if (removedEntities.length > 0) {
      snapshot.rm = removedEntities;
    }
    if (currentState.collisions.length > 0) {
      snapshot.cols = currentState.collisions.map(col => ({
        e: col.eliminatedId,
        r: col.eliminatorId
      }));
    }

    return snapshot;
  }

  private hasPlayerChanged(current: Player, previous: any): boolean {
    if (!previous) return true;
    
    return (
      Math.abs(current.x - previous.x) > 0.1 ||
      Math.abs(current.y - previous.y) > 0.1 ||
      Math.abs(current.size - previous.size) > 0.1 ||
      current.isAlive !== previous.isAlive
    );
  }

  private hasPlayerChangedCompact(current: Player, lastSnapshot: GameSnapshot | null, playerId: string): boolean {
    if (!lastSnapshot || !lastSnapshot.delta.players[playerId]) return true;
    
    const previous = lastSnapshot.delta.players[playerId];
    return this.hasPlayerChanged(current, previous);
  }

  private getPlayerDelta(current: Player, previous: any): Partial<Player> {
    if (!previous) return current;
    
    const delta: Partial<Player> = {};
    
    if (Math.abs(current.x - previous.x) > 0.1) delta.x = current.x;
    if (Math.abs(current.y - previous.y) > 0.1) delta.y = current.y;
    if (Math.abs(current.size - previous.size) > 0.1) delta.size = current.size;
    if (current.isAlive !== previous.isAlive) delta.isAlive = current.isAlive;
    if (current.velocityX !== previous.velocityX) delta.velocityX = current.velocityX;
    if (current.velocityY !== previous.velocityY) delta.velocityY = current.velocityY;
    
    return Object.keys(delta).length > 0 ? delta : current;
  }

  acknowledgeClient(playerId: string, tick: number): void {
    const clientState = this.clientStates.get(playerId);
    if (clientState) {
      clientState.lastAckTick = tick;
    }
  }

  removeClient(playerId: string): void {
    this.clientStates.delete(playerId);
  }

  reset(): void {
    this.lastSnapshot = null;
    this.clientStates.clear();
  }

  // Get snapshot size estimation
  getSnapshotSize(snapshot: CompactSnapshot | GameSnapshot): number {
    return JSON.stringify(snapshot).length;
  }

  // Enable/disable compression
  setCompression(enabled: boolean): void {
    this.compressionEnabled = enabled;
  }

  // Get client diagnostics
  getClientDiagnostics(playerId: string) {
    const clientState = this.clientStates.get(playerId);
    if (!clientState) return null;
    
    return {
      lastAckTick: clientState.lastAckTick,
      knownPlayers: clientState.knownPlayers.size,
      knownFoods: clientState.knownFoods.size
    };
  }
}