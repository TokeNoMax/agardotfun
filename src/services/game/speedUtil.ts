
// speedUtil.ts – Standard Agar.io-like speed curve for *all* modes
// ---------------------------------------------------------------
// v = BASE_SPEED / sqrt(mass)  where mass = r^2
// r in pixels, v in pixels per second
// ---------------------------------------------------------------

export const BASE_SPEED = 1100;              // tweak: 900 slower, 1300 faster

/**
 * Compute movement speed in px/s for a given blob radius.
 * Matches the classic Agar.io feeling (small fast, big slow).
 */
export function computeSpeed(radiusPx: number): number {
  if (radiusPx <= 0 || !Number.isFinite(radiusPx)) return 0;
  const mass = radiusPx * radiusPx;
  return BASE_SPEED / Math.sqrt(mass);
}

// ---------------------------------------------------------------
// Helper to apply a velocity vector towards a target (x,y)
// dt in seconds.
// ---------------------------------------------------------------
export function moveToward(
  blob: { x: number; y: number; r: number },
  target: { x: number; y: number },
  dt: number
) {
  const dx = target.x - blob.x;
  const dy = target.y - blob.y;
  const len = Math.hypot(dx, dy) || 1;
  const speed = computeSpeed(blob.r);
  blob.x += (dx / len) * speed * dt;
  blob.y += (dy / len) * speed * dt;
}

/**
 * Helper to convert radius to size (for compatibility with existing code)
 * In the game, 'size' typically represents radius
 */
export function computeSpeedFromSize(size: number): number {
  return computeSpeed(size);
}
