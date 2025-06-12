
import { GameState, GameSnapshot, Player, Food } from '../types/game';

export class SnapshotManager {
  private lastSnapshot: GameState | null = null;

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
        collisions: [...currentState.collisions]
      }
    };

    if (!this.lastSnapshot) {
      // First snapshot, send everything
      snapshot.delta.players = { ...currentState.players };
      snapshot.delta.foods.added = { ...currentState.foods };
    } else {
      // Calculate delta for players
      for (const [playerId, player] of Object.entries(currentState.players)) {
        const lastPlayer = this.lastSnapshot.players[playerId];
        
        if (!lastPlayer) {
          // New player
          snapshot.delta.players[playerId] = { ...player };
        } else {
          // Check for changes
          const changes: Partial<Player> = {};
          
          if (Math.abs(player.x - lastPlayer.x) > 0.1) changes.x = player.x;
          if (Math.abs(player.y - lastPlayer.y) > 0.1) changes.y = player.y;
          if (Math.abs(player.size - lastPlayer.size) > 0.1) changes.size = player.size;
          if (player.isAlive !== lastPlayer.isAlive) changes.isAlive = player.isAlive;
          if (Math.abs(player.velocityX - lastPlayer.velocityX) > 0.1) changes.velocityX = player.velocityX;
          if (Math.abs(player.velocityY - lastPlayer.velocityY) > 0.1) changes.velocityY = player.velocityY;
          
          if (Object.keys(changes).length > 0) {
            changes.id = playerId;
            snapshot.delta.players[playerId] = changes;
          }
        }
      }

      // Check for removed players
      for (const playerId of Object.keys(this.lastSnapshot.players)) {
        if (!currentState.players[playerId]) {
          snapshot.delta.players[playerId] = { id: playerId, isAlive: false };
        }
      }

      // Calculate delta for foods
      for (const [foodId, food] of Object.entries(currentState.foods)) {
        if (!this.lastSnapshot.foods[foodId]) {
          snapshot.delta.foods.added[foodId] = food;
        }
      }

      for (const foodId of Object.keys(this.lastSnapshot.foods)) {
        if (!currentState.foods[foodId]) {
          snapshot.delta.foods.removed.push(foodId);
        }
      }
    }

    this.lastSnapshot = this.deepClone(currentState);
    return snapshot;
  }

  private deepClone<T>(obj: T): T {
    return JSON.parse(JSON.stringify(obj));
  }

  reset(): void {
    this.lastSnapshot = null;
  }
}
