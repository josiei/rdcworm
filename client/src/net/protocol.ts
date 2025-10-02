// shared/net/protocol.ts
export type Vec = { x: number; y: number };

export type WorldView = { width: number; height: number };

export type PlayerHead = { pos: Vec; angle: number };

export type PlayerView = {
  id: string;
  name: string;
  color: string;
  avatar?: string;           // path like "/avatars/rdc-bloop.svg"
  head: PlayerHead;          // head position + facing
  body: Vec[];               // tail points, newest first or last – see renderer
  score: number;
  alive: boolean;
};

export type Food = Vec;

export type Snapshot = {
  t: number;                 // server tick or ms timestamp
  world: WorldView;
  players: PlayerView[];
  foods: Food[];
  dead?: string[];           // ids that died in this frame (optional)
};

// --- Client → Server ---
export type ClientHello = { type: "hello"; name: string; color: string; avatar?: string };
export type TurnMsg     = { type: "turn"; dir: -1 | 0 | 1 };  // -1 left, 0 none, 1 right
export type RespawnMsg  = { type: "respawn" };

// --- Server → Client ---
export type Welcome  = { type: "welcome"; selfId: string; world: WorldView };
export type StateMsg = { type: "state"; snapshot: Snapshot }; // canonical

export type AnyServerMsg = Welcome | StateMsg;
