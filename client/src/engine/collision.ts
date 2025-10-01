// client/src/engine/collision.ts
import type { Vec, World } from "./math";
import { torusDistSq } from "./math";

/** Head vs single polyline body (wrap world) */
export function headHitsBody(
  head: Vec,
  body: Vec[],
  world: World,
  radius: number,
  skipLast = 10
): boolean {
  if (!body.length) return false;
  const r2 = radius * radius;
  const end = Math.max(0, body.length - skipLast);
  for (let i = 0; i < end; i++) {
    if (torusDistSq(head, body[i], world) <= r2) return true;
  }
  return false;
}

/** Head vs many bodies (excluding the owner's own recent tail) */
export function headHitsAnyBody(
  head: Vec,
  bodies: Array<{ ownerId: string; points: Vec[] }>,
  world: World,
  radius: number,
  selfId?: string,
  selfSkip = 10
): string | null {
  for (const { ownerId, points } of bodies) {
    const skip = ownerId === selfId ? selfSkip : 0;
    if (headHitsBody(head, points, world, radius, skip)) return ownerId;
  }
  return null;
}

/** Detect head-to-head collisions; returns a set of wormIds that should die */
export function headHeadDeaths(
  heads: Array<{ id: string; pos: Vec }>,
  world: World,
  radius: number
): Set<string> {
  const dead = new Set<string>();
  const r2 = radius * radius;
  for (let i = 0; i < heads.length; i++) {
    for (let j = i + 1; j < heads.length; j++) {
      const a = heads[i], b = heads[j];
      if (torusDistSq(a.pos, b.pos, world) <= r2) {
        dead.add(a.id); dead.add(b.id); // simple rule: both die
      }
    }
  }
  return dead;
}
