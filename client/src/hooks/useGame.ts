// client/src/hooks/useGame.ts
import { useEffect, useMemo, useRef, useState } from "react";
import type {
  AnyServerMsg, Welcome, StateMsg, Snapshot, WorldView, PlayerView, Food
} from "../net/protocol";

type GameState = {
  connected: boolean;
  selfId: string | null;
  world: WorldView | null;
  snapshot: Snapshot | null;
};

const WS_URL = `ws://localhost:8080`;

function isSnapshot(x: any): x is Snapshot {
  return !!x && typeof x === "object" &&
    typeof x.t === "number" &&
    x.world && typeof x.world.width === "number" && typeof x.world.height === "number" &&
    Array.isArray(x.players) &&
    Array.isArray(x.foods);
}

export function useGame(name: string, color: string, avatar?: string) {
  const [connected, setConnected] = useState(false);
  const [selfId, setSelfId] = useState<string | null>(null);
  const [world, setWorld] = useState<WorldView | null>(null);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

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
      ws.send(JSON.stringify({ type: "hello", name, color, avatar }));
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
        // Accept both canonical { snapshot } and flattened state (back-compat)
        const snap: Snapshot | undefined = isSnapshot(msg.snapshot)
          ? msg.snapshot
          : isSnapshot(msg) ? (msg as Snapshot) : undefined;

        if (!snap) {
          if (throttle("bad-snapshot", 1000)) {
            console.warn("[client] malformed state snapshot", msg);
          }
          return;
        }
        setSnapshot(snap);
        return;
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

  return {
    connected, selfId, world, snapshot, sendTurn,
  } as const;
}
