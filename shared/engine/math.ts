// Shared toroidal math helpers (wrap-around world)
export type Vec = { x: number; y: number };
export type World = { width: number; height: number };

export function wrapCoord(x: number, size: number) {
  return (x + size) % size;
}

// shortest signed delta on a wrap world (so 2999->5 across width 3000 is -6)
export function wrapDelta(d: number, size: number) {
  if (d >  size / 2) return d - size;
  if (d < -size / 2) return d + size;
  return d;
}

export function torusDelta(a: number, b: number, size: number) {
  return wrapDelta(b - a, size);
}

export function torusDistSq(a: Vec, b: Vec, w: World) {
  const dx = wrapDelta(b.x - a.x, w.width);
  const dy = wrapDelta(b.y - a.y, w.height);
  return dx * dx + dy * dy;
}

// Project a world point into camera-local coords centered at `center`
export function projectPoint(p: Vec, center: Vec, world: World): Vec {
  return {
    x: wrapDelta(p.x - center.x, world.width),
    y: wrapDelta(p.y - center.y, world.height),
  };
}
