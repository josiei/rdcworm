// server/src/index.ts
import { createServer } from "http";
import { WebSocketServer } from "ws";
import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import type {
  ClientHello, TurnMsg, BoostMsg, WorldView, Snapshot, PlayerView, Vec, StateMsg, Welcome, FoodItem
} from "../../client/src/net/protocol";

// Import shared collision utilities
import { type BodyData } from "../../shared/engine/collision";

const TICK_HZ = 30;
const WORLD: WorldView = { width: 5000, height: 3000 };
const PORT = Number(process.env.PORT) || 8080;

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
  boosting: boolean;      // true when player is boosting
};

// Create HTTP server to serve static files
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const clientDistPath = join(__dirname, '../../../../client/dist');

const server = createServer((req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  let filePath = req.url === '/' ? '/index.html' : (req.url || '/index.html');
  const fullPath = join(clientDistPath, filePath);
  
  if (existsSync(fullPath)) {
    const content = readFileSync(fullPath);
    const ext = filePath.split('.').pop() || 'html';
    
    const contentTypes: Record<string, string> = {
      'html': 'text/html',
      'js': 'application/javascript', 
      'css': 'text/css',
      'svg': 'image/svg+xml',
      'png': 'image/png',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'gif': 'image/gif',
      'ico': 'image/x-icon'
    };
    
    res.setHeader('Content-Type', contentTypes[ext] || 'text/plain');
    res.writeHead(200);
    res.end(content);
  } else {
    res.writeHead(404);
    res.end('Not Found');
  }
});

// Create WebSocket server attached to HTTP server
const wss = new WebSocketServer({ server });

// Start the server
server.listen(PORT, () => {
  console.log(`[server] HTTP + WebSocket listening on :${PORT}`);
});

const players = new Map<string, PlayerState>();
let foods: Vec[] = [];
let bonusFood: FoodItem[] = [];

// Food type definitions
const FOOD_TYPES = {
  bug: { value: 5, rarity: 0.70, asset: "/foodAssets/rdc-bug.svg" },
  jira: { value: 10, rarity: 0.25, asset: "/foodAssets/rdc-jira.svg" },
  zillow: { value: 50, rarity: 0.05, asset: "/foodAssets/rdc-zillow.svg" }
} as const;

function generateBonusFood(): FoodItem {
  const rand = Math.random();
  let type: keyof typeof FOOD_TYPES;
  
  if (rand < 0.05) type = "zillow";      // 5% - rare (50 points)
  else if (rand < 0.30) type = "jira";   // 25% - uncommon (10 points)
  else type = "bug";                     // 70% - common (5 points)
  
  return {
    x: Math.random() * WORLD.width,
    y: Math.random() * WORLD.height,
    type,
    value: FOOD_TYPES[type].value
  };
}

function seedFoods(n = 250) {
  // Regular yellow dot food (unchanged)
  foods = Array.from({ length: n }, () => ({
    x: Math.random() * WORLD.width,
    y: Math.random() * WORLD.height,
  }));
  
  // Bonus asset-based food (20% of total food count)
  const bonusCount = Math.floor(n * 0.2); // ~50 bonus food items
  bonusFood = Array.from({ length: bonusCount }, () => generateBonusFood());
  
  console.log(`[food] Seeded ${n} regular food + ${bonusCount} bonus food items`);
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
    boosting: false,
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

    // boost logic: speed increase + score depletion
    const BASE_SPEED = 4.0;
    const BOOST_MULTIPLIER = 1.8; // 80% faster when boosting
    const BOOST_COST_PER_TICK = 0.5; // Score points lost per tick while boosting
    
    if (p.boosting && p.score > 10) {
      p.speed = BASE_SPEED * BOOST_MULTIPLIER;
      p.score -= BOOST_COST_PER_TICK;
      // Auto-stop boosting when score gets too low
      if (p.score <= 10) {
        p.boosting = false;
        p.score = 10; // Prevent going below minimum
      }
    } else {
      p.speed = BASE_SPEED;
      p.boosting = false; // Stop boosting if score too low
    }

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

  // eat bonus food
  for (let i = bonusFood.length - 1; i >= 0; i--) {
    const f = bonusFood[i];
    let eaten = false;
    for (const p of players.values()) {
      if (!p.alive) continue;
      if (dist2(p.pos, f) <= FOOD_R2) {
        p.score += f.value; // Use food's point value
        eaten = true;
        console.log(`[bonus-food] ${p.name} ate ${f.type} (+${f.value} points, total: ${p.score})`);
        break;
      }
    }
    if (eaten) {
      bonusFood.splice(i, 1);
      // respawn new bonus food
      bonusFood.push(generateBonusFood());
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
    boosting: p.boosting ? true : undefined, // Only include if boosting
  };
}

function snapshot(now: number): Snapshot {
  return {
    t: now,
    world: WORLD,
    players: Array.from(players.values()).map(toView),
    foods,
    bonusFood: bonusFood.length > 0 ? bonusFood : undefined, // Only include if we have bonus food
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
    }

    if (msg.type === "turn" && me) {
      const t = msg as TurnMsg;
      if (t.dir === -1 || t.dir === 0 || t.dir === 1) me.turn = t.dir;
    }

    if (msg.type === "boost" && me) {
      const b = msg as BoostMsg;
      me.boosting = b.boosting;
    }

    if (msg.type === "respawn" && me && !me.alive) {
      // Reset to baby worm state
      me.pos = { x: Math.random() * WORLD.width, y: Math.random() * WORLD.height };
      me.angle = Math.random() * Math.PI * 2;
      me.body = [];        // Baby worm - no body segments
      me.score = 10;       // Reset to starting score
      me.alive = true;     // Back to life
      me.turn = 0;         // Reset turn state
      me.boosting = false; // Reset boost state
      
      console.log(`[respawn] ${me.name} respawned as baby worm at (${Math.round(me.pos.x)}, ${Math.round(me.pos.y)})`);
    }
  });

  ws.on("close", () => {
    console.log("[server] socket closed");
    if (me) players.delete(me.id);
    me = null;
  });
});
