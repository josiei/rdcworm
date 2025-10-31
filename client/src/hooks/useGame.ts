// client/src/hooks/useGame.ts
import { useEffect, useRef, useState } from "react";
import type {
  AnyServerMsg, Welcome, Snapshot, WorldView
} from "../net/protocol";


const WS_URL = typeof window !== 'undefined' && window.location.protocol === 'https:' 
  ? `wss://${window.location.host}` 
  : `ws://localhost:8080`;

function isSnapshot(x: any): x is Snapshot {
  return !!x && typeof x === "object" &&
    typeof x.t === "number" &&
    x.world && typeof x.world.width === "number" && typeof x.world.height === "number" &&
    Array.isArray(x.players) &&
    Array.isArray(x.foods);
}

type InterpolationBuffer = {
  prev: Snapshot | null;
  next: Snapshot | null;
  prevTime: number;
  nextTime: number;
};

export function useGame(
  name: string, 
  color: string, 
  avatar?: string,
  roomId?: string,
  mode?: "playing" | "spectating",
  adminToken?: string
) {
  const [connected, setConnected] = useState(false);
  const [selfId, setSelfId] = useState<string | null>(null);
  const [world, setWorld] = useState<WorldView | null>(null);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const snapBuffer = useRef<InterpolationBuffer>({
    prev: null,
    next: null,
    prevTime: 0,
    nextTime: 0
  });

  // throttle helper for logs
  const throttle = (key: string, ms: number) => {
    const t = (throttle as any)._t ||= new Map<string, number>();
    const now = performance.now();
    const last = t.get(key) ?? 0;
    if (now - last >= ms) { t.set(key, now); return true; }
    return false;
  };

  useEffect(() => {
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.addEventListener("open", () => {
      setConnected(true);
      console.log(`[client] ws open: ${WS_URL}`);
      
      const helloMsg: any = { 
        type: "hello", 
        name, 
        color, 
        avatar,
        roomId: roomId || "chill",
        mode: mode || "playing"
      };
      
      // Include admin token if provided
      if (adminToken) {
        helloMsg.adminToken = adminToken;
        console.log(`[client] Authenticating as admin`);
      }
      
      ws.send(JSON.stringify(helloMsg));
    });

    ws.addEventListener("message", (e) => {
      let msg: AnyServerMsg | any;
      try { msg = JSON.parse(e.data); } catch { return; }

      if (msg.type === "welcome") {
        const w = msg as Welcome;
        setSelfId(w.selfId);
        setWorld(w.world);
        console.log("[client] recv welcome:", w);
        return;
      }

      if (msg.type === "state") {
        const snap = msg.snapshot;
        if (!isSnapshot(snap)) {
          if (throttle("bad-snap", 1000)) console.warn("[client] Invalid snapshot", snap);
          return;
        }
        
        // Buffer snapshots for interpolation
        const now = performance.now();
        
        // Skip if this snapshot is older than what we already have
        // This prevents freeze-then-catchup from delayed packets
        if (snapBuffer.current.next && snap.t < snapBuffer.current.next.t) {
          if (throttle("old-snap", 1000)) console.warn("[client] Skipping old snapshot");
          return;
        }
        
        snapBuffer.current.prev = snapBuffer.current.next;
        snapBuffer.current.prevTime = snapBuffer.current.nextTime;
        snapBuffer.current.next = snap;
        snapBuffer.current.nextTime = now;
        
        setSnapshot(snap);
      }
    });

    ws.addEventListener("error", (err) => {
      if (throttle("ws-error", 1000)) console.warn("[client] ws error:", err);
    });

    ws.addEventListener("close", () => {
      setConnected(false);
      setSelfId(null);
      console.log("[client] ws closed");
      // Optional: simple reconnect
      setTimeout(() => {
        if (wsRef.current === ws) {
          wsRef.current = null;
          // let your app control reconnect if you prefer
        }
      }, 500);
    });

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [name, color, avatar]);

  // send turn
  const sendTurn = (dir: -1 | 0 | 1) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      if (throttle("drop-turn", 1000)) console.debug("[client] DROP send (socket not open)", { type: "turn", dir });
      return;
    }
    ws.send(JSON.stringify({ type: "turn", dir }));
  };

  // send boost
  const sendBoost = (boosting: boolean) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      if (throttle("drop-boost", 1000)) console.debug("[client] DROP boost (socket not open)", { type: "boost", boosting });
      return;
    }
    ws.send(JSON.stringify({ type: "boost", boosting }));
  };

  const sendAdminCommand = (command: any) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === 1) {
      ws.send(JSON.stringify(command));
    }
  };

  return {
    connected, selfId, world, snapshot, sendTurn, sendBoost, sendAdminCommand, snapBuffer: snapBuffer.current,
  } as const;
}
