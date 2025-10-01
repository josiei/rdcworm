// client/src/engine/render.ts
export type Vec = { x: number; y: number };

export type PlayerView = {
  id: string;
  name: string;
  color: string;
  avatar?: string;
  points: Vec[];
  score: number;
};

export type WorldView = { width: number; height: number };
export type FoodView = { id: number; x: number; y: number };

// Grid
export function drawGrid(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  cam: Vec
) {
  ctx.save();
  ctx.fillStyle = "#0f1720";
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = "rgba(255,255,255,0.06)";
  ctx.lineWidth = 1;

  const size = 64;
  const startX = -((cam.x % size) + size) % size;
  const startY = -((cam.y % size) + size) % size;

  for (let x = startX; x < w; x += size) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  for (let y = startY; y < h; y += size) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }
  ctx.restore();
}

// --- path unwrapping so the snake doesn’t shoot across edges ---
function unwrapPath(points: Vec[], world: WorldView): Vec[] {
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

// Snake
export function drawSnake(
  ctx: CanvasRenderingContext2D,
  world: WorldView,
  p: PlayerView,
  cam: Vec,
  thickness: number
) {
  const pts = unwrapPath(p.points, world);
  if (pts.length < 2) return;

  ctx.save();
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.strokeStyle = p.color;
  ctx.lineWidth = thickness;

  ctx.beginPath();
  ctx.moveTo(pts[0].x - cam.x, pts[0].y - cam.y);
  for (let i = 1; i < pts.length; i++) {
    ctx.lineTo(pts[i].x - cam.x, pts[i].y - cam.y);
  }
  ctx.stroke();

  // Head (circle) – your avatar can be composited here if you want
  const head = pts[pts.length - 1];
  ctx.fillStyle = p.color;
  ctx.beginPath();
  ctx.arc(head.x - cam.x, head.y - cam.y, thickness * 0.6, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

// Food
export function drawFoods(
  ctx: CanvasRenderingContext2D,
  foods: FoodView[],
  cam: Vec
) {
  ctx.save();
  ctx.fillStyle = "#F6C453";
  for (const f of foods) {
    ctx.beginPath();
    ctx.arc(f.x - cam.x, f.y - cam.y, 4.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}