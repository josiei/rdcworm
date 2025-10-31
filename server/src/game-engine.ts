// server/src/game-engine.ts
// Pure game logic functions (testable, no side effects)

import type { Vec, WorldView } from '../../client/src/net/protocol';

// Physics helpers
export function wrap(v: number, max: number): number {
  if (v < 0) return v + max;
  if (v >= max) return v - max;
  return v;
}

export function dist2(a: Vec, b: Vec): number {
  const dx = a.x - b.x, dy = a.y - b.y;
  return dx*dx + dy*dy;
}

// Constants
export const FOOD_R2 = 18*18;
export const HEAD_R2 = 14*14;
export const TURN_SPEED = 0.12;
export const BASE_SPEED = 4.0;
export const BOOST_MULTIPLIER = 1.8;
export const BOOST_COST_PER_TICK = 0.5;

// Body length calculation
export function calculateBodyLength(score: number): number {
  const targetLen = Math.max(15, Math.floor(score * 0.8));
  const maxLen = 300;
  return Math.min(targetLen, maxLen);
}

// Thickness calculation
export function calculateThickness(score: number): number {
  const targetLen = Math.max(15, Math.floor(score * 0.8));
  const maxLen = 300;
  const baseThickness = 14;
  const maxThickness = 28;
  
  if (targetLen >= maxLen) {
    const excessScore = score - (maxLen / 0.8);
    const thicknessBonus = Math.min(excessScore * 0.1, maxThickness - baseThickness);
    return baseThickness + Math.max(0, thicknessBonus);
  }
  return baseThickness;
}

// Food burst calculation
export function calculateFoodBurst(bodyLength: number, score: number): { segmentFood: number; bonusFood: number } {
  const bodySegments = Math.min(bodyLength, 150);
  const segmentFood = Math.floor(bodySegments / 3);
  const bonusFood = Math.min(Math.floor(score / 8), 25);
  
  return { segmentFood, bonusFood };
}
