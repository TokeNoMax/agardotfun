
// speedUtil.ts – Standard Agar.io-like speed curve for *all* modes
// ---------------------------------------------------------------
// v = max(MIN_SPEED, BASE_SPEED / radius^EXPONENT)
// size = mass (r²), v in pixels per second
// ---------------------------------------------------------------

export const BASE_SPEED = 400;   // rythme global (increased from 350)
export const EXPONENT = 0.75;    // décroissance plus forte
export const MIN_SPEED = 20;     // plancher jouabilité

/**
 * Compute movement speed in px/s for a given blob size.
 * Uses a steeper curve with minimum speed floor for better gameplay.
 * @param size - The blob size (mass = r²)
 * @returns Speed in pixels per second
 */
export function computeSpeed(size: number): number {
  if (!Number.isFinite(size) || size <= 0) return 0;
  const radius = Math.sqrt(size);
  const v = BASE_SPEED / Math.pow(radius, EXPONENT);
  return Math.max(MIN_SPEED, v);
}

// ---------------------------------------------------------------
// Helper to apply a velocity vector towards a target (x,y)
// dt in seconds.
// ---------------------------------------------------------------
export function moveToward(
  blob: { x: number; y: number; size: number },
  target: { x: number; y: number },
  dt: number
) {
  const dx = target.x - blob.x;
  const dy = target.y - blob.y;
  const len = Math.hypot(dx, dy) || 1;
  const speed = computeSpeed(blob.size);
  blob.x += (dx / len) * speed * dt;
  blob.y += (dy / len) * speed * dt;
}

/**
 * Helper to convert radius to size (for compatibility with existing code)
 * In the game, 'size' typically represents mass (radius²)
 */
export function computeSpeedFromSize(size: number): number {
  return computeSpeed(size);
}
