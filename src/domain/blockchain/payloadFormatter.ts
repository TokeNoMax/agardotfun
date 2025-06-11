
/**
 * Pure business logic for formatting on-chain payloads
 * No React dependencies - pure functions only
 */

export interface GameAction {
  type: 'MOVE' | 'CONSUME' | 'ABSORB' | 'ELIMINATE';
  timestamp: number;
  playerId: string;
  data: any;
}

export interface MovePayload {
  x: number;
  y: number;
  velocityX: number;
  velocityY: number;
  size: number;
}

export interface ConsumeFoodPayload {
  foodId: string;
  newSize: number;
  position: { x: number; y: number };
}

export interface AbsorbPlayerPayload {
  absorbedPlayerId: string;
  newSize: number;
  position: { x: number; y: number };
}

export interface EliminationPayload {
  eliminatedPlayerId: string;
  eliminatorPlayerId: string;
  eliminationType: 'absorption' | 'zone' | 'timeout';
  finalSize: number;
  position: { x: number; y: number };
}

/**
 * Format movement data for on-chain submission
 * @param playerId Player identifier
 * @param position Current position and movement data
 * @returns Formatted game action
 */
export function formatMoveAction(
  playerId: string,
  position: MovePayload
): GameAction {
  if (!playerId || typeof playerId !== 'string') {
    throw new Error('Player ID is required');
  }

  // Validate position data
  if (typeof position.x !== 'number' || typeof position.y !== 'number') {
    throw new Error('Invalid position coordinates');
  }

  if (typeof position.size !== 'number' || position.size <= 0) {
    throw new Error('Invalid player size');
  }

  return {
    type: 'MOVE',
    timestamp: Date.now(),
    playerId,
    data: {
      x: Math.round(position.x * 100) / 100, // Round to 2 decimal places
      y: Math.round(position.y * 100) / 100,
      velocityX: Math.round((position.velocityX || 0) * 100) / 100,
      velocityY: Math.round((position.velocityY || 0) * 100) / 100,
      size: Math.round(position.size * 100) / 100
    }
  };
}

/**
 * Format food consumption for on-chain submission
 * @param playerId Player identifier
 * @param consumeData Food consumption data
 * @returns Formatted game action
 */
export function formatConsumeFoodAction(
  playerId: string,
  consumeData: ConsumeFoodPayload
): GameAction {
  if (!playerId || typeof playerId !== 'string') {
    throw new Error('Player ID is required');
  }

  if (!consumeData.foodId || typeof consumeData.foodId !== 'string') {
    throw new Error('Food ID is required');
  }

  if (typeof consumeData.newSize !== 'number' || consumeData.newSize <= 0) {
    throw new Error('Invalid new size');
  }

  return {
    type: 'CONSUME',
    timestamp: Date.now(),
    playerId,
    data: {
      foodId: consumeData.foodId,
      newSize: Math.round(consumeData.newSize * 100) / 100,
      position: {
        x: Math.round(consumeData.position.x * 100) / 100,
        y: Math.round(consumeData.position.y * 100) / 100
      }
    }
  };
}

/**
 * Format player absorption for on-chain submission
 * @param playerId Player identifier (absorber)
 * @param absorbData Absorption data
 * @returns Formatted game action
 */
export function formatAbsorbPlayerAction(
  playerId: string,
  absorbData: AbsorbPlayerPayload
): GameAction {
  if (!playerId || typeof playerId !== 'string') {
    throw new Error('Player ID is required');
  }

  if (!absorbData.absorbedPlayerId || typeof absorbData.absorbedPlayerId !== 'string') {
    throw new Error('Absorbed player ID is required');
  }

  if (typeof absorbData.newSize !== 'number' || absorbData.newSize <= 0) {
    throw new Error('Invalid new size');
  }

  return {
    type: 'ABSORB',
    timestamp: Date.now(),
    playerId,
    data: {
      absorbedPlayerId: absorbData.absorbedPlayerId,
      newSize: Math.round(absorbData.newSize * 100) / 100,
      position: {
        x: Math.round(absorbData.position.x * 100) / 100,
        y: Math.round(absorbData.position.y * 100) / 100
      }
    }
  };
}

/**
 * Format player elimination for on-chain submission
 * @param eliminationData Elimination event data
 * @returns Formatted game action
 */
export function formatEliminationAction(
  eliminationData: EliminationPayload
): GameAction {
  if (!eliminationData.eliminatedPlayerId || typeof eliminationData.eliminatedPlayerId !== 'string') {
    throw new Error('Eliminated player ID is required');
  }

  if (!eliminationData.eliminatorPlayerId || typeof eliminationData.eliminatorPlayerId !== 'string') {
    throw new Error('Eliminator player ID is required');
  }

  const validEliminationTypes = ['absorption', 'zone', 'timeout'];
  if (!validEliminationTypes.includes(eliminationData.eliminationType)) {
    throw new Error('Invalid elimination type');
  }

  return {
    type: 'ELIMINATE',
    timestamp: Date.now(),
    playerId: eliminationData.eliminatorPlayerId,
    data: {
      eliminatedPlayerId: eliminationData.eliminatedPlayerId,
      eliminatorPlayerId: eliminationData.eliminatorPlayerId,
      eliminationType: eliminationData.eliminationType,
      finalSize: Math.round(eliminationData.finalSize * 100) / 100,
      position: {
        x: Math.round(eliminationData.position.x * 100) / 100,
        y: Math.round(eliminationData.position.y * 100) / 100
      }
    }
  };
}

/**
 * Batch multiple actions for efficient on-chain submission
 * @param actions Array of game actions
 * @returns Batched payload
 */
export function batchGameActions(actions: GameAction[]): {
  batchId: string;
  timestamp: number;
  actions: GameAction[];
  actionCount: number;
} {
  if (!Array.isArray(actions) || actions.length === 0) {
    throw new Error('Actions array cannot be empty');
  }

  // Validate all actions
  actions.forEach((action, index) => {
    if (!action.type || !action.timestamp || !action.playerId) {
      throw new Error(`Invalid action at index ${index}`);
    }
  });

  return {
    batchId: `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    timestamp: Date.now(),
    actions: actions.sort((a, b) => a.timestamp - b.timestamp), // Sort by timestamp
    actionCount: actions.length
  };
}

/**
 * Compress game action for reduced payload size
 * @param action Game action to compress
 * @returns Compressed action data
 */
export function compressGameAction(action: GameAction): any {
  const compressed: any = {
    t: action.type.charAt(0), // M, C, A, E
    ts: action.timestamp,
    p: action.playerId,
    d: {}
  };

  // Compress data based on action type
  switch (action.type) {
    case 'MOVE':
      compressed.d = {
        x: action.data.x,
        y: action.data.y,
        vx: action.data.velocityX,
        vy: action.data.velocityY,
        s: action.data.size
      };
      break;
    case 'CONSUME':
      compressed.d = {
        f: action.data.foodId,
        s: action.data.newSize,
        pos: [action.data.position.x, action.data.position.y]
      };
      break;
    case 'ABSORB':
      compressed.d = {
        ap: action.data.absorbedPlayerId,
        s: action.data.newSize,
        pos: [action.data.position.x, action.data.position.y]
      };
      break;
    case 'ELIMINATE':
      compressed.d = {
        ep: action.data.eliminatedPlayerId,
        el: action.data.eliminatorPlayerId,
        et: action.data.eliminationType.charAt(0),
        s: action.data.finalSize,
        pos: [action.data.position.x, action.data.position.y]
      };
      break;
  }

  return compressed;
}
