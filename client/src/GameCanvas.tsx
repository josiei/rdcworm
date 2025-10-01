import React, { useEffect, useRef } from "react";
import { drawGrid, drawSnake, drawFoods } from "./engine/render";
import type { PlayerView, WorldView, FoodView } from "./engine/render";

type Props = {
  me: string | null;
  world: WorldView | null;
  players: PlayerView[];
  foods: FoodView[];
};

export default function GameCanvas({ me, world, players, foods }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const c = canvasRef.current!;
    const fit = () => { c.width = innerWidth; c.height = innerHeight; };
    fit(); addEventListener("resize", fit);
    return () => removeEventListener("resize", fit);
  }, []);

  useEffect(() => {
    const c = canvasRef.current!;
    const ctx = c.getContext("2d")!;
    let raf = 0;

    const loop = () => {
      raf = requestAnimationFrame(loop);
      ctx.clearRect(0, 0, c.width, c.height);
      if (!world) return;

      const meP = players.find((p) => p.id === me);
      const head = meP?.points.at(-1);
      const cam = head
        ? { x: head.x - c.width / 2, y: head.y - c.height / 2 }
        : { x: 0, y: 0 };

      drawGrid(ctx, c.width, c.height, cam);
      drawFoods(ctx, foods, cam);
      for (const p of players) drawSnake(ctx, world, p, cam, 16);
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [world, players, foods, me]);

  return <canvas ref={canvasRef} style={{ display: "block" }} />;
}
