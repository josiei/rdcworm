// client/src/engine/render.ts
export type Vec = { x: number; y: number };

// --- path unwrapping so the snake doesn't shoot across edges ---
export function unwrapPath(points: Vec[], world: { width: number; height: number }): Vec[] {
  if (points.length === 0) return [];
  const out: Vec[] = [points[0]];
  for (let i = 1; i < points.length; i++) {
    const prev = out[out.length - 1];
    let dx = points[i].x - prev.x;
    let dy = points[i].y - prev.y;

    if (dx > world.width / 2) dx -= world.width;
    if (dx < -world.width / 2) dx += world.width;
    if (dy > world.height / 2) dy -= world.height;
    if (dy < -world.height / 2) dy += world.height;

    out.push({ x: prev.x + dx, y: prev.y + dy });
  }
  return out;
}