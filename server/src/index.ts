// server/src/index.ts
import { createServer } from "http";
import { WebSocketServer } from "ws";
import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import type {
  ClientHello, TurnMsg, BoostMsg, WorldView, Snapshot, PlayerView, Vec, StateMsg, Welcome, FoodItem
} from "../../client/src/net/protocol";
import { 
  wrap, 
  dist2, 
  FOOD_R2, 
  HEAD_R2, 
  TURN_SPEED,
  BASE_SPEED,
  BOOST_MULTIPLIER,
  BOOST_COST_PER_TICK,
  calculateBodyLength,
  calculateThickness
} from "./game-engine.js";

const TICK_HZ = 30;
const STATE_HZ = 30; // Broadcast at 30 Hz (interpolation disabled due to high latency issues)
const STATE_INTERVAL_MS = 1000 / STATE_HZ;
const WORLD: WorldView = { width: 2000, height: 1200 };
const PORT = Number(process.env.PORT) || 8080;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "josie";

// Admin session tracking
const adminSockets = new Set<string>();

// Room types and configuration
type RoomType = "tournament" | "casual";
type RoomState = "waiting" | "ready_check" | "countdown" | "active" | "finished" | "freeplay";

type RoomConfig = {
  id: string;
  name: string;
  world: WorldView;
  maxPlayers: number;
  description: string;
  type: RoomType;
};

const ROOM_CONFIGS: Record<string, RoomConfig> = {
  arena1: {
    id: "arena1",
    name: "Arena 1",
    world: { width: 2000, height: 1200 },
    maxPlayers: 20,
    description: "Tournament Qualifier - Top 4 advance",
    type: "tournament"
  },
  arena2: {
    id: "arena2",
    name: "Arena 2",
    world: { width: 2000, height: 1200 },
    maxPlayers: 20,
    description: "Tournament Qualifier - Top 4 advance",
    type: "tournament"
  },
  arena3: {
    id: "arena3",
    name: "Arena 3",
    world: { width: 2000, height: 1200 },
    maxPlayers: 20,
    description: "Tournament Qualifier - Top 4 advance",
    type: "tournament"
  },
  deathmatch: {
    id: "deathmatch",
    name: "Deathmatch Finals 🏆",
    world: { width: 1000, height: 600 },
    maxPlayers: 12,
    description: "Tournament Finals - Last worm standing wins",
    type: "tournament"
  },
  chill: {
    id: "chill",
    name: "Chill Zone 🌴",
    world: { width: 2500, height: 1500 },
    maxPlayers: 30,
    description: "Casual play - Join anytime, no timers!",
    type: "casual"
  }
};

// Spatial partitioning for optimized collision detection
class SpatialGrid {
  cellSize: number;
  cols: number;
  rows: number;
  worldWidth: number;
  worldHeight: number;
  grid: Map<string, Array<{ segment: Vec; ownerId: string; segmentIndex: number }>>;

  constructor(worldWidth: number, worldHeight: number, cellSize = 100) {
    this.cellSize = cellSize;
    this.worldWidth = worldWidth;
    this.worldHeight = worldHeight;
    this.cols = Math.ceil(worldWidth / cellSize);
    this.rows = Math.ceil(worldHeight / cellSize);
    this.grid = new Map();
  }

  // Convert world position to grid cell (handles toroidal wrapping)
  cellKey(x: number, y: number): string {
    const cx = Math.floor(x / this.cellSize) % this.cols;
    const cy = Math.floor(y / this.cellSize) % this.rows;
    return `${cx},${cy}`;
  }

  // Add a segment to the grid
  insert(segment: Vec, ownerId: string, segmentIndex: number) {
    const key = this.cellKey(segment.x, segment.y);
    if (!this.grid.has(key)) this.grid.set(key, []);
    this.grid.get(key)!.push({ segment, ownerId, segmentIndex });
  }

  // Get all segments near a position (checks 3×3 cells around it)
  queryNearby(pos: Vec): Array<{ segment: Vec; ownerId: string; segmentIndex: number }> {
    const cx = Math.floor(pos.x / this.cellSize);
    const cy = Math.floor(pos.y / this.cellSize);
    const nearby: Array<{ segment: Vec; ownerId: string; segmentIndex: number }> = [];

    // Check 9 cells: center + 8 neighbors (handles wrapping)
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const checkX = (cx + dx + this.cols) % this.cols;
        const checkY = (cy + dy + this.rows) % this.rows;
        const key = `${checkX},${checkY}`;
        const cell = this.grid.get(key);
        if (cell) nearby.push(...cell);
      }
    }
    return nearby;
  }

  clear() {
    this.grid.clear();
  }
}

type PlayerMode = "playing" | "spectating";

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
  thickness: number;      // body thickness (14 default, grows after max length)
};

type RoomPlayer = {
  socketId: string;
  mode: PlayerMode;
  playerState?: PlayerState;
};

type Room = {
  id: string;
  config: RoomConfig;
  state: RoomState;
  players: Map<string, RoomPlayer>;
  readyPlayers: Set<string>;
  gameState: {
    foods: Vec[];
    bonusFood: FoodItem[];
    activePlayers: Map<string, PlayerState>;
  };
  timing?: {
    roundStartTime: number;
    roundDuration: number;
    countdownStartTime?: number;
  };
  lastBroadcastTime: number;
  tournament?: {
    topPlayers: Array<{ id: string; name: string; score: number }>;
    advancedPlayers: Set<string>;
  };
};

// Create HTTP server to serve static files
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// Try multiple paths to find client dist (works in dev and production)
let clientDistPath = join(__dirname, '../../client/dist'); // Development: server/src -> client/dist
if (!existsSync(clientDistPath)) {
  clientDistPath = join(__dirname, '../../../client/dist'); // Production: dist/server/src -> client/dist
}
if (!existsSync(clientDistPath)) {
  clientDistPath = join(__dirname, '../../../../client/dist'); // Fallback
}
console.log('[server] Client dist path:', clientDistPath);

const server = createServer((req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  // Strip query parameters from URL
  const urlPath = (req.url || '/').split('?')[0];
  let filePath = urlPath === '/' ? '/index.html' : urlPath;
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

// Room registry - replaces global players/foods
const rooms = new Map<string, Room>();

// Socket ID to room ID mapping
const socketToRoom = new Map<string, string>();

// Keep legacy global state for backward compatibility during migration
const players = new Map<string, PlayerState>();
let foods: Vec[] = [];
let bonusFood: FoodItem[] = [];

// Food type definitions
const FOOD_TYPES = {
  bug: { value: 5, rarity: 0.70, asset: "/foodAssets/rdc-bug.svg" },
  jira: { value: 10, rarity: 0.25, asset: "/foodAssets/rdc-jira.svg" },
  zillow: { value: 30, rarity: 0.05, asset: "/foodAssets/rdc-zillow.svg" }
} as const;

// Seed foods for a specific room
function seedFoodsForRoom(room: Room, n = 250) {
  const world = room.config.world;
  
  // Regular yellow dot food
  room.gameState.foods = Array.from({ length: n }, () => ({
    x: Math.random() * world.width,
    y: Math.random() * world.height,
  }));
  
  // Bonus asset-based food (20% of total food count)
  const bonusCount = Math.floor(n * 0.2);
  room.gameState.bonusFood = Array.from({ length: bonusCount }, () => generateBonusFoodForRoom(world));
  
  console.log(`[food] ${room.config.name}: Seeded ${n} regular + ${bonusCount} bonus food`);
}

// Room initialization
function initializeRooms() {
  for (const config of Object.values(ROOM_CONFIGS)) {
    const room: Room = {
      id: config.id,
      config,
      state: config.type === "casual" ? "freeplay" : "waiting",
      players: new Map(),
      readyPlayers: new Set(),
      gameState: {
        foods: [],
        bonusFood: [],
        activePlayers: new Map()
      },
      lastBroadcastTime: 0
    };
    
    // Add timing for tournament rooms
    if (config.type === "tournament") {
      room.timing = {
        roundStartTime: 0,
        roundDuration: 10 * 60 * 1000,  // 10 minutes
      };
      room.tournament = {
        topPlayers: [],
        advancedPlayers: new Set()
      };
    }
    
    // Seed food for this room
    seedFoodsForRoom(room, config.type === "casual" ? 300 : 250);
    
    rooms.set(config.id, room);
    
    // Start game loop for this room
    startRoomGameLoop(room);
    
    console.log(`[rooms] Initialized ${config.name} (${config.type})`);
  }
  
  console.log(`[rooms] Total rooms: ${rooms.size}`);
  console.log(`[admin] Admin token configured. Use ?admin=${ADMIN_TOKEN} in URL`);
}

// Start game loop for a specific room
function startRoomGameLoop(room: Room) {
  setInterval(() => {
    // For now, run all rooms (tournament logic will be added later)
    // if (room.config.type === "tournament" && room.state !== "active") {
    //   return;
    // }
    
    const now = Date.now();
    const dead = stepRoom(room);
    
    // Throttle broadcasts to 20 Hz
    const shouldBroadcast = dead.length > 0 || (now - room.lastBroadcastTime) >= STATE_INTERVAL_MS;
    if (!shouldBroadcast) return;
    
    room.lastBroadcastTime = now;
    
    // Create snapshot for this room
    const snap: Snapshot = {
      t: now,
      world: room.config.world,
      players: Array.from(room.gameState.activePlayers.values()).map(toView),
      foods: room.gameState.foods,
      bonusFood: room.gameState.bonusFood.length > 0 ? room.gameState.bonusFood : undefined,
    };
    
    if (dead.length) snap.dead = dead;
    
    // Add tournament timer info if active
    if (room.config.type === "tournament" && room.state === "active" && room.timing) {
      const elapsed = now - room.timing.roundStartTime;
      const remaining = Math.max(0, room.timing.roundDuration - elapsed);
      (snap as any).tournamentTimer = {
        state: room.state,
        remaining: Math.floor(remaining / 1000), // seconds
        duration: Math.floor(room.timing.roundDuration / 1000)
      };
      
      // Auto-end round when timer expires
      if (remaining <= 0 && room.state === "active") {
        room.state = "finished";
        
        // Find winner (top score) and store it
        const players = Array.from(room.gameState.activePlayers.values());
        if (players.length > 0) {
          const winner = players.reduce((top, p) => p.score > top.score ? p : top);
          room.tournament = {
            topPlayers: [{ id: winner.id, name: winner.name, score: winner.score }],
            advancedPlayers: new Set()
          };
          console.log(`[tournament] ${room.config.name} round ended - Winner: ${winner.name} (${winner.score})`);
        } else {
          console.log(`[tournament] ${room.config.name} round ended (timer expired)`);
        }
      }
    }
    
    // Show winner overlay if round is finished
    if (room.state === "finished" && room.tournament && room.tournament.topPlayers.length > 0) {
      const winner = room.tournament.topPlayers[0];
      (snap as any).tournamentWinner = {
        name: winner.name,
        score: winner.score
      };
    }
    
    const payload: StateMsg = { type: "state", snapshot: snap };
    
    // Broadcast only to clients in this room
    for (const client of wss.clients) {
      if (client.readyState === 1 && (client as any).roomId === room.id) {
        client.send(JSON.stringify(payload));
      }
    }
  }, 1000 / TICK_HZ);
}

function generateBonusFoodForRoom(world: WorldView): FoodItem {
  const rand = Math.random();
  let type: keyof typeof FOOD_TYPES;
  
  if (rand < 0.05) type = "zillow";      // 5% - rare (30 points)
  else if (rand < 0.30) type = "jira";   // 25% - uncommon (10 points)
  else type = "bug";                     // 70% - common (5 points)
  
  return {
    x: Math.random() * world.width,
    y: Math.random() * world.height,
    type,
    value: FOOD_TYPES[type].value
  };
}

// Legacy function for backward compatibility
function generateBonusFood(): FoodItem {
  return generateBonusFoodForRoom(WORLD);
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

// Admin command handlers
function handleAdminCommand(ws: any, msg: any, isAdmin: boolean) {
  if (!isAdmin) {
    ws.send(JSON.stringify({ type: "error", message: "Unauthorized: Admin access required" }));
    return;
  }
  
  if (msg.type === "admin:startTournament") {
    const roomIds = msg.roomIds as string[] || ["arena1", "arena2", "arena3"];
    console.log(`[admin] Starting tournament for rooms: ${roomIds.join(", ")}`);
    
    for (const roomId of roomIds) {
      const room = rooms.get(roomId);
      if (!room || room.config.type !== "tournament") continue;
      
      room.state = "active";
      if (room.timing) {
        room.timing.roundStartTime = Date.now();
      }
      
      // Clear previous winner overlay
      if (room.tournament) {
        room.tournament.topPlayers = [];
        room.tournament.advancedPlayers.clear();
      }
      
      console.log(`[admin] ${room.config.name} tournament started`);
    }
    
    ws.send(JSON.stringify({ type: "adminSuccess", message: `Tournament started for ${roomIds.length} rooms` }));
  }
  
  if (msg.type === "admin:endRound") {
    const roomId = msg.roomId as string;
    const room = rooms.get(roomId);
    
    if (!room || room.config.type !== "tournament") {
      ws.send(JSON.stringify({ type: "error", message: "Invalid room" }));
      return;
    }
    
    room.state = "finished";
    console.log(`[admin] Ended round for ${room.config.name}`);
    
    ws.send(JSON.stringify({ type: "adminSuccess", message: `Round ended for ${room.config.name}` }));
  }
  
  if (msg.type === "admin:resetTournament") {
    console.log(`[admin] Resetting all tournament rooms`);
    
    for (const room of rooms.values()) {
      if (room.config.type !== "tournament") continue;
      
      room.state = "waiting";
      room.readyPlayers.clear();
      if (room.timing) {
        room.timing.roundStartTime = 0;
      }
      if (room.tournament) {
        room.tournament.topPlayers = [];
        room.tournament.advancedPlayers.clear();
      }
    }
    
    ws.send(JSON.stringify({ type: "adminSuccess", message: "Tournament reset" }));
  }
  
  if (msg.type === "admin:getRoomStatus") {
    const roomStatuses = Array.from(rooms.values()).map(room => ({
      id: room.id,
      name: room.config.name,
      type: room.config.type,
      state: room.state,
      playerCount: room.gameState.activePlayers.size,
      maxPlayers: room.config.maxPlayers
    }));
    
    ws.send(JSON.stringify({ type: "roomStatus", rooms: roomStatuses }));
  }
}

// Broadcast room status to all clients periodically
function broadcastRoomStatus() {
  const roomStatuses = Array.from(rooms.values()).map(room => ({
    id: room.id,
    name: room.config.name,
    type: room.config.type,
    state: room.state,
    playerCount: room.gameState.activePlayers.size,
    spectatorCount: 0, // TODO: implement spectator tracking
    maxPlayers: room.config.maxPlayers,
    locked: room.state === "finished" || (room.id === "deathmatch" && room.state === "waiting")
  }));
  
  const payload = JSON.stringify({ type: "roomStatus", rooms: roomStatuses });
  
  for (const client of wss.clients) {
    if (client.readyState === 1) {
      client.send(payload);
    }
  }
}

// Broadcast room status every 2 seconds
setInterval(broadcastRoomStatus, 2000);

// Initialize rooms on startup (replaces seedFoods)
initializeRooms();

// Legacy: seed foods for backward compatibility
seedFoods();

// Spawn player in a specific room
function spawnPlayerInRoom(room: Room, id: string, name: string, color: string, avatar?: string): PlayerState {
  const world = room.config.world;
  const p: PlayerState = {
    id, name, color, avatar,
    pos: { x: Math.random() * world.width, y: Math.random() * world.height },
    angle: Math.random() * Math.PI * 2,
    speed: 4.0,
    body: [],
    score: 10,
    alive: true,
    turn: 0,
    boosting: false,
    thickness: 14,
  };
  room.gameState.activePlayers.set(id, p);
  return p;
}

// Legacy function for backward compatibility
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
    thickness: 14,
  };
  players.set(id, p);
  return p;
}

// Physics helpers imported from game-engine.ts

// Create food burst when worm dies (room-aware)
function createFoodBurstInRoom(player: PlayerState, world: WorldView): Vec[] {
  const burstFood: Vec[] = [];
  
  // Scale burst with worm size (bigger worms = bigger bursts)
  const bodySegments = Math.min(player.body.length, 150);
  const segmentFood = Math.floor(bodySegments / 3);
  
  // Scale bonus with score (high scorers = more bonus food)
  const bonusFoodCount = Math.min(Math.floor(player.score / 8), 25);
  
  console.log(`[food-burst] ${player.name} (score: ${player.score}, body: ${bodySegments}) creating ${segmentFood + bonusFoodCount} food items`);
  
  // Create food from body segments
  for (let i = 0; i < segmentFood; i++) {
    const segmentIndex = i * 3;
    if (segmentIndex < player.body.length) {
      const segment = player.body[segmentIndex];
      const offsetX = (Math.random() - 0.5) * 40;
      const offsetY = (Math.random() - 0.5) * 40;
      
      burstFood.push({
        x: wrap(segment.x + offsetX, world.width),
        y: wrap(segment.y + offsetY, world.height)
      });
    }
  }
  
  // Create bonus food in circle pattern
  for (let i = 0; i < bonusFoodCount; i++) {
    const angle = (Math.PI * 2 * i) / bonusFoodCount;
    const radius = 60 + Math.random() * 40;
    burstFood.push({
      x: wrap(player.pos.x + Math.cos(angle) * radius, world.width),
      y: wrap(player.pos.y + Math.sin(angle) * radius, world.height)
    });
  }
  
  return burstFood;
}

// Legacy function
function createFoodBurst(player: PlayerState): Vec[] {
  return createFoodBurstInRoom(player, WORLD);
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

// Room-scoped game step
function stepRoom(room: Room): string[] {
  const world = room.config.world;
  const players = room.gameState.activePlayers;
  const foods = room.gameState.foods;
  const bonusFood = room.gameState.bonusFood;
  
  // move players
  for (const p of players.values()) {
    if (!p.alive) continue;
    // steering
    p.angle += p.turn * TURN_SPEED;
    
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
    p.pos.x = wrap(p.pos.x + Math.cos(p.angle) * p.speed, world.width);
    p.pos.y = wrap(p.pos.y + Math.sin(p.angle) * p.speed, world.height);

    // grow body: push a copy of head every N ticks
    p.body.unshift({ x: p.pos.x, y: p.pos.y });
    const finalLen = calculateBodyLength(p.score);
    if (p.body.length > finalLen) p.body.length = finalLen;

    // Thickness progression: after max length, continue growing thicker
    p.thickness = calculateThickness(p.score);
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
      foods.push({ x: Math.random() * world.width, y: Math.random() * world.height });
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
      bonusFood.push(generateBonusFoodForRoom(world));
    }
  }

  // collisions (head-to-body, optimized with spatial partitioning)
  const dead: string[] = [];
  
  // Build spatial grid from all body segments
  const grid = new SpatialGrid(world.width, world.height, 100);
  for (const p of players.values()) {
    if (!p.alive) continue;
    for (let i = 0; i < p.body.length; i++) {
      grid.insert(p.body[i], p.id, i);
    }
  }

  // Check each player head against nearby segments only
  for (const p of players.values()) {
    if (!p.alive) continue;
    
    const nearbySegments = grid.queryNearby(p.pos);
    
    for (const { segment, ownerId, segmentIndex } of nearbySegments) {
      // allow touching your first few segments (hinge)
      if (ownerId === p.id && segmentIndex < 6) continue;
      
      if (dist2(p.pos, segment) < HEAD_R2) {
        p.alive = false;
        dead.push(p.id);
        
        // Create food burst from dead worm
        const burstFood = createFoodBurstInRoom(p, world);
        foods.push(...burstFood);
        
        break;
      }
    }
    if (!p.alive) break;
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
        const burstFoodA = createFoodBurstInRoom(playerA, world);
        const burstFoodB = createFoodBurstInRoom(playerB, world);
        foods.push(...burstFoodA, ...burstFoodB);
        
        console.log(`[collision] Head-to-head: ${playerA.name} and ${playerB.name} both died`);
      }
    }
  }

  // Clean up distant food if over cap (room-scoped version would go here)
  // For now, skip cleanup in stepRoom to keep it simple

  return dead;
}

// Legacy step function for backward compatibility
// Routes to chill room for now until we fully migrate
function step(): string[] {
  const chillRoom = rooms.get("chill");
  if (chillRoom) {
    return stepRoom(chillRoom);
  }
  return [];
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
    thickness: p.thickness !== 14 ? p.thickness : undefined, // Only include if different from default
  };
}

function snapshot(now: number): Snapshot {
  // Get data from chill room for legacy compatibility
  const chillRoom = rooms.get("chill");
  if (chillRoom) {
    return {
      t: now,
      world: chillRoom.config.world,
      players: Array.from(chillRoom.gameState.activePlayers.values()).map(toView),
      foods: chillRoom.gameState.foods,
      bonusFood: chillRoom.gameState.bonusFood.length > 0 ? chillRoom.gameState.bonusFood : undefined,
    };
  }
  
  // Fallback to legacy global state
  return {
    t: now,
    world: WORLD,
    players: Array.from(players.values()).map(toView),
    foods,
    bonusFood: bonusFood.length > 0 ? bonusFood : undefined,
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

// Legacy global game loop - DISABLED (using per-room loops now)
// setInterval(broadcastState, 1000 / TICK_HZ);

// --- Connections ---
wss.on("connection", (ws) => {
  console.log("[server] socket connected");
  const id = crypto.randomUUID();
  let me: PlayerState | null = null;
  let currentRoomId: string | null = null;
  let isAdmin = false;

  ws.on("message", (buf) => {
    let msg: any;
    try { msg = JSON.parse(buf.toString("utf-8")); } catch { return; }

    if (msg.type === "hello") {
      const hello = msg as ClientHello & { roomId?: string; mode?: string; adminToken?: string };
      const requestedRoomId = hello.roomId || "chill";
      
      // Check admin token
      if (hello.adminToken && hello.adminToken === ADMIN_TOKEN) {
        isAdmin = true;
        adminSockets.add(id);
        console.log(`[admin] Admin authenticated: ${hello.name || "Admin"}`);
        ws.send(JSON.stringify({ type: "adminGranted", message: "Admin privileges granted" }));
      }
      
      // Get the requested room
      const room = rooms.get(requestedRoomId);
      const mode = hello.mode || "playing";
      
      if (room) {
        currentRoomId = requestedRoomId;
        socketToRoom.set(id, requestedRoomId);
        (ws as any).roomId = requestedRoomId;
        
        // Only spawn a worm if playing, not spectating
        if (mode === "playing") {
          me = spawnPlayerInRoom(room, id, hello.name || "Player", hello.color || "#22cc88", hello.avatar);
          console.log(`[server] ${me.name} joined ${room.config.name} (${requestedRoomId}) => id ${id}`);
        } else {
          console.log(`[server] ${hello.name || "Spectator"} spectating ${room.config.name} (${requestedRoomId})`);
        }
        
        const welcome: Welcome = { type: "welcome", selfId: mode === "playing" ? id : "", world: room.config.world };
        ws.send(JSON.stringify(welcome));
      } else {
        // Fallback to legacy if room not found
        me = spawnPlayer(id, hello.name || "Player", hello.color || "#22cc88", hello.avatar);
        console.log(`[server] hello from ${me.name} => id ${id} (room ${requestedRoomId} not found, using legacy)`);
        
        const welcome: Welcome = { type: "welcome", selfId: id, world: WORLD };
        ws.send(JSON.stringify(welcome));
      }
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
      // Get world from chill room
      const chillRoom = rooms.get("chill");
      const world = chillRoom ? chillRoom.config.world : WORLD;
      
      // Reset to baby worm state
      me.pos = { x: Math.random() * world.width, y: Math.random() * world.height };
      me.angle = Math.random() * Math.PI * 2;
      me.body = [];        // Baby worm - no body segments
      me.score = 10;       // Reset to starting score
      me.alive = true;     // Back to life
      me.turn = 0;         // Reset turn state
      me.boosting = false; // Reset boost state
      me.thickness = 14;   // Reset thickness to default
      
      console.log(`[respawn] ${me.name} respawned as baby worm at (${Math.round(me.pos.x)}, ${Math.round(me.pos.y)})`);
    }
    
    // Handle admin commands
    if (msg.type && msg.type.startsWith("admin:")) {
      handleAdminCommand(ws, msg, isAdmin);
    }
  });

  ws.on("close", () => {
    console.log("[server] socket closed");
    
    // Clean up from legacy global state
    if (me) players.delete(me.id);
    
    // Clean up from room state
    if (currentRoomId && me) {
      const room = rooms.get(currentRoomId);
      if (room) {
        room.gameState.activePlayers.delete(me.id);
        console.log(`[server] Removed ${me.name} from ${room.config.name}`);
      }
    }
    
    // Clean up tracking
    if (currentRoomId) {
      socketToRoom.delete(id);
    }
    if (isAdmin) {
      adminSockets.delete(id);
    }
    
    me = null;
  });
});
