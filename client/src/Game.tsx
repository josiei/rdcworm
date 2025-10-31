// client/src/Game.tsx
import { useEffect, useRef, useMemo } from "react";
import { useGame } from "./hooks/useGame";
import type { Snapshot, PlayerView, Vec, FoodItem } from "./net/protocol";
import Leaderboard from "./ui/Leaderboard";
import Score from "./ui/Score";
import TournamentTimer from "./ui/TournamentTimer";
import TournamentEndOverlay from "./ui/TournamentEndOverlay";

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

// ---------- interpolation helpers (disabled) ----------
// Interpolation disabled for now due to high latency issues
// function lerpVec(a: Vec, b: Vec, t: number): Vec {
//   return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
// }
// 
// function lerpAngle(a: number, b: number, t: number): number {
//   let diff = b - a;
//   while (diff > Math.PI) diff -= 2 * Math.PI;
//   while (diff < -Math.PI) diff += 2 * Math.PI;
//   return a + diff * t;
// }
//
// function interpolateSnapshot(prev: any, next: any, t: number): any {
//   if (!prev || !next) return next;
//   
//   return {
//     ...next,
//     players: next.players.map((np: PlayerView) => {
//       const pp = prev.players.find((p: PlayerView) => p.id === np.id);
//       if (!pp) return np;
//       
//       return {
//         ...np,
//         head: {
//           pos: lerpVec(pp.head.pos, np.head.pos, t),
//           angle: lerpAngle(pp.head.angle, np.head.angle, t)
//         },
//         body: np.body.map((nb: Vec, i: number) => {
//           if (i >= pp.body.length) return nb;
//           return lerpVec(pp.body[i], nb, t);
//         })
//       };
//     })
//   };
// }

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

// ---------- food asset cache ----------
function useFoodAssetCache() {
  const cache = useMemo(() => new Map<string, HTMLImageElement>(), []);
  const get = (asset?: string) => {
    if (!asset) return null;
    let img = cache.get(asset);
    if (img) return img;
    img = new Image();
    // Improve SVG rendering quality
    img.style.imageRendering = 'crisp-edges';
    img.crossOrigin = 'anonymous';
    img.src = asset;
    cache.set(asset, img);
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

function drawFoods(ctx: CanvasRenderingContext2D, foods: Vec[]) {
  ctx.save();
  ctx.fillStyle = "#F7C96E";
  for (const f of foods) {
    ctx.beginPath();
    ctx.arc(f.x, f.y, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// Food type definitions (matching server)
const FOOD_TYPES = {
  bug: { value: 5, size: 24, color: "#ff6b6b", asset: "/foodAssets/rdc-bug.svg" },
  jira: { value: 10, size: 32, color: "#4dabf7", asset: "/foodAssets/rdc-jira.svg" },
  zillow: { value: 30, size: 48, color: "#51cf66", asset: "/foodAssets/rdc-zillow.svg" }
} as const;

function drawBonusFood(ctx: CanvasRenderingContext2D, bonusFood: FoodItem[], foodAssets: any) {
  if (bonusFood.length === 0) return;
  
  ctx.save();
  
  // Set quality settings once for all assets
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  
  // Group by food type to minimize context switches
  const foodByType = {
    bug: bonusFood.filter(f => f.type === 'bug'),
    jira: bonusFood.filter(f => f.type === 'jira'),
    zillow: bonusFood.filter(f => f.type === 'zillow')
  };
  
  // Draw each type in batches
  for (const [type, foods] of Object.entries(foodByType)) {
    if (foods.length === 0) continue;
    
    const foodType = FOOD_TYPES[type as keyof typeof FOOD_TYPES];
    const img = foodAssets.get(foodType.asset);
    const size = foodType.size;
    
    if (img && img.complete) {
      // Draw all assets of this type
      for (const food of foods) {
        ctx.drawImage(img, food.x - size/2, food.y - size/2, size, size);
      }
    } else {
      // Fallback: draw all circles of this type in one path
      ctx.fillStyle = foodType.color;
      ctx.beginPath();
      for (const food of foods) {
        ctx.moveTo(food.x + size/2, food.y);
        ctx.arc(food.x, food.y, size/2, 0, Math.PI * 2);
      }
      ctx.fill();
    }
  }
  
  ctx.restore();
}

function drawBody(ctx: CanvasRenderingContext2D, p: PlayerView, world: { width: number; height: number }) {
  const pts = unwrapBodyPath(p.body, world);
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = p.color;
  ctx.lineWidth = p.thickness || 14; // Dynamic thickness with fallback

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
  const thicknessRatio = (p.thickness || 14) / 14; // Scale with thickness
  const fallbackRadius = 8 * thicknessRatio;
  ctx.arc(p.head.pos.x, p.head.pos.y, fallbackRadius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawHeadAvatar(ctx: CanvasRenderingContext2D, p: PlayerView, img: HTMLImageElement | null) {
  if (!img || !img.complete) return; // not yet loaded
  const baseRadius = 22;
  const thicknessRatio = (p.thickness || 14) / 14; // Scale with thickness
  const r = baseRadius * thicknessRatio; // Dynamic head size
  const { x, y } = p.head.pos;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(p.head.angle + Math.PI / 2);
  ctx.drawImage(img, -r, -r, r * 2, r * 2);
  ctx.restore();
}

function drawPlayerName(ctx: CanvasRenderingContext2D, p: PlayerView, selfId?: string) {
  // Don't show your own name (you know it's you)
  if (p.id === selfId) return;
  
  const { x, y } = p.head.pos;
  const thicknessRatio = (p.thickness || 14) / 14;
  const headRadius = 22 * thicknessRatio;
  
  // Truncate long names for clean visual display
  const maxLength = 12; // Reasonable limit for gameplay
  const displayName = p.name.length > maxLength 
    ? p.name.substring(0, maxLength - 1) + "…" 
    : p.name;
  
  // Position name above the head with some padding
  const nameY = y - headRadius - 8;
  
  ctx.save();
  ctx.font = "12px Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  
  // Draw text outline for better readability
  ctx.lineWidth = 3;
  ctx.strokeStyle = "rgba(0, 0, 0, 0.8)";
  ctx.strokeText(displayName, x, nameY);
  
  // Draw main text
  ctx.fillStyle = "white";
  ctx.fillText(displayName, x, nameY);
  
  ctx.restore();
}

// ---------- death overlay component ----------
function DeathOverlay({ playerName }: { 
  playerName: string; 
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
export default function Game({ 
  name, 
  color, 
  avatar,
  roomId,
  mode,
  adminToken,
  onBackToLobby
}: { 
  name: string; 
  color: string; 
  avatar?: string;
  roomId?: string;
  mode?: "playing" | "spectating";
  adminToken?: string;
  onBackToLobby?: () => void;
}) {
  const { selfId, world, snapshot, sendTurn, sendBoost } = useGame(name, color, avatar, roomId, mode, adminToken);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const avatars = useAvatarCache();
  const foodAssets = useFoodAssetCache();
  
  const isSpectating = mode === "spectating";
  
  // Smooth zoom animation state
  const currentZoom = useRef(isSpectating ? 1.0 : 2.5); // Spectators see full map
  const targetZoom = useRef(isSpectating ? 1.0 : 2.5);

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

  // zoom with mouse wheel (disabled for spectators)
  useEffect(() => {
    if (isSpectating) return; // Spectators have fixed zoom
    
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      targetZoom.current = Math.max(0.5, Math.min(5, targetZoom.current * delta));
    };
    window.addEventListener("wheel", onWheel, { passive: false });
    return () => window.removeEventListener("wheel", onWheel);
  }, [isSpectating]);

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

  // keyboard -> turn and boost messages
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.type === "keydown") {
        if (e.key === "ArrowLeft" || e.key.toLowerCase() === "a") sendTurn(-1);
        if (e.key === "ArrowRight" || e.key.toLowerCase() === "d") sendTurn(1);
        if (e.key === "ArrowUp" || e.key.toLowerCase() === "w") sendBoost(true);
        
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
        if (e.key === "ArrowUp" || e.key.toLowerCase() === "w") sendBoost(false);
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKey);
    };
  }, [sendTurn, sendBoost]);

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

      let snap: Snapshot | null = snapshot;
      if (!snap || !world) {
        raf = requestAnimationFrame(loop);
        return;
      }

      // Interpolation disabled for now - causing issues with high latency
      // TODO: Re-enable with better network handling
      // if (snapBuffer.prev && snapBuffer.next && snapBuffer.nextTime > snapBuffer.prevTime) {
      //   const now = performance.now();
      //   const elapsed = now - snapBuffer.prevTime;
      //   const duration = snapBuffer.nextTime - snapBuffer.prevTime;
      //   if (duration < 200) {
      //     const t = Math.max(0, Math.min(1, elapsed / duration));
      //     const interpolated = interpolateSnapshot(snapBuffer.prev, snapBuffer.next, t);
      //     if (interpolated) snap = interpolated;
      //   }
      // }

      const players = snap!.players;
      const me = selfId ? players.find(p => p.id === selfId) : undefined;

      if (canLog("frame-info", 1000)) {
        console.log("[draw] players:", players.length, "self:", selfId, !!me ? "found" : "missing");
      }

      // camera: center view on our head with smooth adaptive zoom
      // Dynamic zoom based on worm size - closer when small, further when big
      let zoom = 2.5; // Default zoom for baby worms
      let camX = 0, camY = 0;
      
      if (isSpectating) {
        // Spectator mode: show full map
        zoom = Math.min(c.width / world.width, c.height / world.height);
        camX = 0;
        camY = 0;
      } else if (me) {
        const score = me.score;
        
        // Calculate target zoom based on score
        const newTargetZoom = Math.max(1.0, 2.5 - (score - 10) / 100);
        targetZoom.current = newTargetZoom;
        
        // Smooth interpolation towards target zoom
        const zoomDiff = targetZoom.current - currentZoom.current;
        const lerpSpeed = 0.05; // Adjust for faster/slower transitions
        
        if (Math.abs(zoomDiff) > 0.001) {
          currentZoom.current += zoomDiff * lerpSpeed;
        } else {
          currentZoom.current = targetZoom.current; // Snap when very close
        }
        
        zoom = currentZoom.current; // Use interpolated zoom value
        // Account for zoom when calculating camera position
        const effectiveWidth = c.width / zoom;
        const effectiveHeight = c.height / zoom;
        
        camX = Math.round(me.head.pos.x - effectiveWidth / 2);
        camY = Math.round(me.head.pos.y - effectiveHeight / 2);
        // simple clamp so we don't drift to negatives if you don't want wrap
        camX = Math.max(0, Math.min(camX, world.width - effectiveWidth));
        camY = Math.max(0, Math.min(camY, world.height - effectiveHeight));
      }

      // world transform with zoom
      ctx.save();
      ctx.scale(zoom, zoom);
      ctx.translate(-camX, -camY);

      // draw world contents in world-space
      drawGrid(ctx, world.width, world.height);
      drawFoods(ctx, snap!.foods);
      if (snap!.bonusFood) {
        drawBonusFood(ctx, snap!.bonusFood, foodAssets);
      }
      for (const p of players.filter(p => p.alive)) {
        drawBody(ctx, p, world);
        const img = avatars.get(p.avatar);
        // always draw a fallback head so worm never disappears
        drawHeadFallback(ctx, p);
        drawHeadAvatar(ctx, p, img);
        drawPlayerName(ctx, p, selfId || undefined);
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
          {!isSpectating && <Score player={selfId ? snapshot.players.find(p => p.id === selfId) : undefined} />}
          <Leaderboard players={snapshot.players} />
          {(() => {
            const me = selfId ? snapshot.players.find(p => p.id === selfId) : undefined;
            return me && !me.alive ? <DeathOverlay playerName={name} /> : null;
          })()}
          {(snapshot as any).tournamentTimer && (
            <TournamentTimer 
              remaining={(snapshot as any).tournamentTimer.remaining}
              duration={(snapshot as any).tournamentTimer.duration}
            />
          )}
          {(snapshot as any).tournamentWinner && (
            <TournamentEndOverlay
              winnerName={(snapshot as any).tournamentWinner.name}
              winnerScore={(snapshot as any).tournamentWinner.score}
            />
          )}
          {isSpectating && onBackToLobby && (
            <button
              onClick={onBackToLobby}
              style={{
                position: "fixed",
                bottom: 20,
                left: "50%",
                transform: "translateX(-50%)",
                padding: "12px 24px",
                background: "rgba(34, 204, 136, 0.9)",
                color: "#001015",
                border: "2px solid rgba(255, 255, 255, 0.3)",
                borderRadius: 8,
                fontWeight: 600,
                cursor: "pointer",
                fontSize: 14,
                zIndex: 100,
              }}
            >
              ← Back to Lobby
            </button>
          )}
        </>
      )}
    </>
  );
}
