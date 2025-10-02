// client/src/Game.tsx
import { useEffect, useMemo, useRef } from "react";
import type { Food, PlayerView, Snapshot, Vec } from "./net/protocol";
import { useGame } from "./hooks/useGame";
import Leaderboard from "./ui/Leaderboard";
import Score from "./ui/Score";

// ---------- small log throttle so console doesn't spam ----------
const canLog = (() => {
  const t = new Map<string, number>();
  return (k: string, ms = 1000) => {
    const now = performance.now();
    const last = t.get(k) ?? 0;
    if (now - last >= ms) { t.set(k, now); return true; }
    return false;
  };
})();

// ---------- avatar cache ----------
function useAvatarCache() {
  const cache = useMemo(() => new Map<string, HTMLImageElement>(), []);
  const get = (url?: string) => {
    if (!url) return null;
    let img = cache.get(url);
    if (img) return img;
    img = new Image();
    img.src = url;
    cache.set(url, img);
    return img;
  };
  return { get };
}

// ---------- drawing helpers (world coords) ----------
function unwrapBodyPath(body: Vec[], world: { width: number; height: number }): Vec[] {
  if (body.length === 0) return [];
  const out: Vec[] = [body[0]];
  for (let i = 1; i < body.length; i++) {
    const prev = out[out.length - 1];
    let dx = body[i].x - prev.x;
    let dy = body[i].y - prev.y;

    if (dx > world.width / 2) dx -= world.width;
    if (dx < -world.width / 2) dx += world.width;
    if (dy > world.height / 2) dy -= world.height;
    if (dy < -world.height / 2) dy += world.height;

    out.push({ x: prev.x + dx, y: prev.y + dy });
  }
  return out;
}

function drawGrid(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,0.05)";
  ctx.lineWidth = 1;
  const step = 100;
  for (let x = 0; x <= w; x += step) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
  }
  for (let y = 0; y <= h; y += step) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
  }
  ctx.restore();
}

function drawFoods(ctx: CanvasRenderingContext2D, foods: Food[]) {
  ctx.save();
  ctx.fillStyle = "#F7C96E";
  for (const f of foods) {
    ctx.beginPath();
    ctx.arc(f.x, f.y, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawBody(ctx: CanvasRenderingContext2D, p: PlayerView, world: { width: number; height: number }) {
  const pts = unwrapBodyPath(p.body, world);
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = p.color;
  ctx.lineWidth = 14;

  if (pts.length >= 2) {
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.stroke();
  } else if (pts.length === 1) {
    ctx.beginPath();
    ctx.arc(pts[0].x, pts[0].y, 7, 0, Math.PI * 2);
    ctx.fillStyle = p.color;
    ctx.fill();
  }
  ctx.restore();
}

function drawHeadFallback(ctx: CanvasRenderingContext2D, p: PlayerView) {
  ctx.save();
  ctx.fillStyle = p.color;
  ctx.beginPath();
  ctx.arc(p.head.pos.x, p.head.pos.y, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawHeadAvatar(ctx: CanvasRenderingContext2D, p: PlayerView, img: HTMLImageElement | null) {
  if (!img || !img.complete) return; // not yet loaded
  const r = 14;
  const { x, y } = p.head.pos;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(p.head.angle + Math.PI / 2);
  ctx.drawImage(img, -r, -r, r * 2, r * 2);
  ctx.restore();
}

// ---------- death overlay component ----------
function DeathOverlay({ playerName, onRespawn }: { 
  playerName: string; 
  onRespawn: () => void; 
}) {
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      zIndex: 1000,
    }}>
      <div style={{
        background: 'rgba(15, 28, 42, 0.95)',
        border: '2px solid #ff6b6b',
        borderRadius: 12,
        padding: '40px 60px',
        textAlign: 'center',
        color: 'white',
        fontFamily: 'monospace',
      }}>
        <div style={{ fontSize: 32, marginBottom: 20 }}>💀 YOU DIED!</div>
        <div style={{ fontSize: 16, opacity: 0.8, marginBottom: 20 }}>
          {playerName} was eliminated
        </div>
        <div style={{ fontSize: 18, marginBottom: 10 }}>
          Press <strong>SPACEBAR</strong> to respawn
        </div>
        <div style={{ fontSize: 14, opacity: 0.6 }}>
          You'll start as a baby worm
        </div>
      </div>
    </div>
  );
}

// ---------- main component ----------
export default function Game({ name, color, avatar }: { name: string; color: string; avatar?: string }) {
  const { selfId, world, snapshot, sendTurn } = useGame(name, color, avatar);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const avatars = useAvatarCache();

  // resize canvas to viewport
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const resize = () => {
      c.width = window.innerWidth;
      c.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  // respawn handler
  const handleRespawn = () => {
    // Send respawn message using existing sendTurn mechanism
    // We'll need to extend sendTurn to handle respawn messages
    if (snapshot) {
      const me = selfId ? snapshot.players.find(p => p.id === selfId) : undefined;
      if (me && !me.alive) {
        // For now, we'll use a simple page reload approach
        window.location.reload();
      }
    }
  };

  // keyboard -> turn messages
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.type === "keydown") {
        if (e.key === "ArrowLeft" || e.key.toLowerCase() === "a") sendTurn(-1);
        if (e.key === "ArrowRight" || e.key.toLowerCase() === "d") sendTurn(1);
        
        // Spacebar respawn
        if (e.key === " ") {
          const me = selfId && snapshot ? snapshot.players.find(p => p.id === selfId) : undefined;
          if (me && !me.alive) {
            handleRespawn();
          }
        }
      } else {
        if (e.key === "ArrowLeft" || e.key.toLowerCase() === "a") sendTurn(0);
        if (e.key === "ArrowRight" || e.key.toLowerCase() === "d") sendTurn(0);
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKey);
    };
  }, [sendTurn]);

  // render loop with camera that centers on self head
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d")!;
    let raf = 0;

    const loop = () => {
      ctx.clearRect(0, 0, c.width, c.height);
      // background
      ctx.fillStyle = "#0F1C2A";
      ctx.fillRect(0, 0, c.width, c.height);

      const snap: Snapshot | null = snapshot;
      if (!snap || !world) {
        raf = requestAnimationFrame(loop);
        return;
      }

      const players = snap.players;
      const me = selfId ? players.find(p => p.id === selfId) : undefined;

      if (canLog("frame-info", 1000)) {
        console.log("[draw] players:", players.length, "self:", selfId, !!me ? "found" : "missing");
      }

      // camera: center view on our head; clamp to world
      let camX = 0, camY = 0;
      if (me) {
        camX = Math.round(me.head.pos.x - c.width / 2);
        camY = Math.round(me.head.pos.y - c.height / 2);
        // simple clamp so we don't drift to negatives if you don't want wrap
        camX = Math.max(0, Math.min(camX, world.width - c.width));
        camY = Math.max(0, Math.min(camY, world.height - c.height));
      }

      // world transform
      ctx.save();
      ctx.translate(-camX, -camY);

      // draw world contents in world-space
      drawGrid(ctx, world.width, world.height);
      drawFoods(ctx, snap.foods);
      for (const p of players.filter(p => p.alive)) {
        drawBody(ctx, p, world);
        const img = avatars.get(p.avatar);
        // always draw a fallback head so worm never disappears
        drawHeadFallback(ctx, p);
        drawHeadAvatar(ctx, p, img);
      }

      ctx.restore();
      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [snapshot, world, selfId, avatars]);

  // HUD (minimal)
  return (
    <>
      <canvas
        ref={canvasRef}
        style={{ position: "fixed", inset: 0, width: "100vw", height: "100vh", display: "block", background: "rgb(15,28,42)" }}
      />
      {snapshot && (
        <>
          <Score player={selfId ? snapshot.players.find(p => p.id === selfId) : undefined} />
          <Leaderboard players={snapshot.players} />
          {(() => {
            const me = selfId ? snapshot.players.find(p => p.id === selfId) : undefined;
            return me && !me.alive ? <DeathOverlay playerName={name} onRespawn={handleRespawn} /> : null;
          })()}
        </>
      )}
    </>
  );
}
