// server/src/index.ts
import { WebSocketServer } from "ws";
import type {
  ClientHello, TurnMsg, WorldView, Snapshot, PlayerView, Vec, StateMsg, Welcome
} from "../../client/src/net/protocol";

// Import shared collision utilities
import { type BodyData } from "../../shared/engine/collision";

const TICK_HZ = 30;
const WORLD: WorldView = { width: 5000, height: 3000 };

type PlayerState = {
  id: string;
  name: string;
  color: string;
  avatar?: string;
  pos: Vec;
  angle: number;          // radians
  speed: number;          // units / tick
  body: Vec[];
  score: number;
  alive: boolean;
  turn: -1 | 0 | 1;
};

const wss = new WebSocketServer({ port: 8080 });
console.log("[server] listening on :8080");

const players = new Map<string, PlayerState>();
let foods: Vec[] = [];

function seedFoods(n = 250) {
  foods = Array.from({ length: n }, () => ({
    x: Math.random() * WORLD.width,
    y: Math.random() * WORLD.height,
  }));
}
seedFoods();

function spawnPlayer(id: string, name: string, color: string, avatar?: string): PlayerState {
  const p: PlayerState = {
    id, name, color, avatar,
    pos: { x: Math.random() * WORLD.width, y: Math.random() * WORLD.height },
    angle: Math.random() * Math.PI * 2,
    speed: 4.0,
    body: [],
    score: 10,
    alive: true,
    turn: 0,
  };
  players.set(id, p);
  return p;
}

// --- Physics helpers ---
function wrap(v: number, max: number) {
  if (v < 0) return v + max;
  if (v >= max) return v - max;
  return v;
}
function dist2(a: Vec, b: Vec) {
  const dx = a.x - b.x, dy = a.y - b.y;
  return dx*dx + dy*dy;
}
const FOOD_R2 = 18*18;
const HEAD_R2 = 14*14;

// Create food burst when worm dies
function createFoodBurst(player: PlayerState): Vec[] {
  const burstFood: Vec[] = [];
  
  // Scale burst with worm size (bigger worms = bigger bursts)
  const bodySegments = Math.min(player.body.length, 150); // Cap at 150 segments
  const segmentFood = Math.floor(bodySegments / 3);       // Every 3rd segment
  
  // Scale bonus with score (high scorers = more bonus food)
  const bonusFood = Math.min(Math.floor(player.score / 8), 25); // Cap at 25 bonus
  
  console.log(`[food-burst] ${player.name} (score: ${player.score}, body: ${bodySegments}) creating ${segmentFood + bonusFood} food items`);
  
  // Create food from body segments
  for (let i = 0; i < segmentFood; i++) {
    const segmentIndex = i * 3;
    if (segmentIndex < player.body.length) {
      const segment = player.body[segmentIndex];
      const offsetX = (Math.random() - 0.5) * 40;
      const offsetY = (Math.random() - 0.5) * 40;
      
      burstFood.push({
        x: wrap(segment.x + offsetX, WORLD.width),
        y: wrap(segment.y + offsetY, WORLD.height)
      });
    }
  }
  
  // Create bonus food in circle pattern
  for (let i = 0; i < bonusFood; i++) {
    const angle = (Math.PI * 2 * i) / bonusFood;
    const radius = 60 + Math.random() * 40;
    burstFood.push({
      x: wrap(player.pos.x + Math.cos(angle) * radius, WORLD.width),
      y: wrap(player.pos.y + Math.sin(angle) * radius, WORLD.height)
    });
  }
  
  return burstFood;
}

// Clean up food that's far from all players (only when over cap)
function cleanupDistantFood() {
  const MAX_FOOD = 400; // Cap for 20 players
  
  if (foods.length <= MAX_FOOD) return; // Only cleanup when needed
  
  const playerPositions = Array.from(players.values())
    .filter(p => p.alive)
    .map(p => p.pos);
  
  if (playerPositions.length === 0) return; // No players, no cleanup
  
  // Calculate distance to nearest player for each food
  const foodWithDistance = foods.map(food => {
    const nearestPlayerDist = Math.min(...playerPositions.map(playerPos => 
      dist2(playerPos, food)
    ));
    return { food, nearestPlayerDist };
  });
  
  // Sort by distance (furthest from players first)
  foodWithDistance.sort((a, b) => b.nearestPlayerDist - a.nearestPlayerDist);
  
  // Keep only the closest foods to players
  const toKeep = MAX_FOOD - 50; // Keep buffer below max
  foods = foodWithDistance.slice(-toKeep).map(item => item.food);
  
  const removed = foodWithDistance.length - toKeep;
  console.log(`[food-cleanup] Removed ${removed} distant food items. Total food: ${foods.length}`);
}

function step() {
  // move players
  for (const p of players.values()) {
    if (!p.alive) continue;
    // steering
    const TURN_SPEED = 0.12; // radians per tick
    p.angle += p.turn * TURN_SPEED;

    // move
    p.pos.x = wrap(p.pos.x + Math.cos(p.angle) * p.speed, WORLD.width);
    p.pos.y = wrap(p.pos.y + Math.sin(p.angle) * p.speed, WORLD.height);

    // grow body: push a copy of head every N ticks
    p.body.unshift({ x: p.pos.x, y: p.pos.y });
    const targetLen = Math.max(15, Math.floor(p.score * 1.2));
    if (p.body.length > targetLen) p.body.length = targetLen;
  }

  // eat food
  for (let i = foods.length - 1; i >= 0; i--) {
    const f = foods[i];
    let eaten = false;
    for (const p of players.values()) {
      if (!p.alive) continue;
      if (dist2(p.pos, f) <= FOOD_R2) {
        p.score += 1;
        eaten = true;
        break;
      }
    }
    if (eaten) {
      foods.splice(i, 1);
      // respawn somewhere else
      foods.push({ x: Math.random() * WORLD.width, y: Math.random() * WORLD.height });
    }
  }

  // collisions (head-to-body, simple)
  const dead: string[] = [];
  const bodies: BodyData[] =
    Array.from(players.values())
      .filter(p => p.alive)
      .map(p => ({ ownerId: p.id, points: p.body }));

  for (const p of players.values()) {
    if (!p.alive) continue;
    for (const b of bodies) {
      // allow touching your first few segments (hinge)
      const pts = b.ownerId === p.id ? b.points.slice(6) : b.points;
      for (const q of pts) {
        if (dist2(p.pos, q) < HEAD_R2) {
          p.alive = false;
          dead.push(p.id);
          
          // Create food burst from dead worm
          const burstFood = createFoodBurst(p);
          foods.push(...burstFood);
          
          break;
        }
      }
      if (!p.alive) break;
    }
  }

  // Check head-to-head collisions (simple version)
  const alivePlayers = Array.from(players.values()).filter(p => p.alive);
  for (let i = 0; i < alivePlayers.length; i++) {
    for (let j = i + 1; j < alivePlayers.length; j++) {
      const playerA = alivePlayers[i];
      const playerB = alivePlayers[j];
      
      if (dist2(playerA.pos, playerB.pos) < HEAD_R2) {
        // Both worms die in head-to-head collision
        playerA.alive = false;
        playerB.alive = false;
        dead.push(playerA.id, playerB.id);
        
        // Create food bursts from both dead worms
        const burstFoodA = createFoodBurst(playerA);
        const burstFoodB = createFoodBurst(playerB);
        foods.push(...burstFoodA, ...burstFoodB);
        
        console.log(`[collision] Head-to-head: ${playerA.name} and ${playerB.name} both died`);
      }
    }
  }

  // Clean up distant food if over cap
  cleanupDistantFood();

  return dead;
}

function toView(p: PlayerState): PlayerView {
  return {
    id: p.id,
    name: p.name,
    color: p.color,
    avatar: p.avatar,
    head: { pos: { x: p.pos.x, y: p.pos.y }, angle: p.angle },
    body: p.body.slice(), // copy for safety
    score: p.score,
    alive: p.alive,
  };
}

function snapshot(now: number): Snapshot {
  return {
    t: now,
    world: WORLD,
    players: Array.from(players.values()).map(toView),
    foods,
  };
}

function broadcastState() {
  const now = Date.now();
  const dead = step();
  const snap = snapshot(now);
  if (dead.length) snap.dead = dead;
  const payload: StateMsg = { type: "state", snapshot: snap };

  for (const client of wss.clients) {
    if (client.readyState === 1) {
      client.send(JSON.stringify(payload));
    }
  }
}

setInterval(broadcastState, 1000 / TICK_HZ);

// --- Connections ---
wss.on("connection", (ws) => {
  console.log("[server] socket connected");
  const id = crypto.randomUUID();
  let me: PlayerState | null = null;

  ws.on("message", (buf) => {
    let msg: any;
    try { msg = JSON.parse(buf.toString("utf-8")); } catch { return; }

    if (msg.type === "hello") {
      const hello = msg as ClientHello;
      me = spawnPlayer(id, hello.name || "Player", hello.color || "#22cc88", hello.avatar);
      console.log(`[server] hello from ${me.name} => id ${id} avatar: ${hello.avatar ?? "(none)"}`);

      const welcome: Welcome = { type: "welcome", selfId: id, world: WORLD };
      ws.send(JSON.stringify(welcome));
      return;
    }

    if (msg.type === "turn" && me) {
      const t = msg as TurnMsg;
      if (t.dir === -1 || t.dir === 0 || t.dir === 1) me.turn = t.dir;
    }
  });

  ws.on("close", () => {
    console.log("[server] socket closed");
    if (me) players.delete(me.id);
    me = null;
  });
});
