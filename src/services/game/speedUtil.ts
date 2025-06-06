
// speedUtil.ts – Standard Agar.io-like speed curve for *all* modes
// ---------------------------------------------------------------
// v = BASE_SPEED / radius  where radius = sqrt(size)
// size = mass (r²), v in pixels per second
// ---------------------------------------------------------------

export const BASE_SPEED = 2160; // calibré : 180 px/s à radius 12

/**
 * Compute movement speed in px/s for a given blob size.
 * Matches the classic Agar.io feeling (small fast, big slow).
 * @param size - The blob size (mass = r²)
 * @returns Speed in pixels per second
 */
export function computeSpeed(size: number): number {
  if (!Number.isFinite(size) || size <= 0) return 0;
  const radius = Math.sqrt(size);
  return BASE_SPEED / radius;
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
