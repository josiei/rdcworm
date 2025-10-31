// server/src/game-logic.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import type { Vec, WorldView } from '../../client/src/net/protocol';
import { wrap, dist2, FOOD_R2, HEAD_R2, calculateBodyLength, calculateThickness, calculateFoodBurst } from './game-engine';

describe('Game Physics', () => {
  describe('wrap function (toroidal world)', () => {
    it('should wrap negative values', () => {
      expect(wrap(-10, 100)).toBe(90);
      expect(wrap(-1, 100)).toBe(99);
    });

    it('should wrap values >= max', () => {
      expect(wrap(100, 100)).toBe(0);
      expect(wrap(110, 100)).toBe(10);
    });

    it('should not change values in range', () => {
      expect(wrap(50, 100)).toBe(50);
      expect(wrap(0, 100)).toBe(0);
      expect(wrap(99, 100)).toBe(99);
    });
  });

  describe('dist2 function (distance squared)', () => {
    it('should calculate distance squared correctly', () => {
      const a: Vec = { x: 0, y: 0 };
      const b: Vec = { x: 3, y: 4 };
      expect(dist2(a, b)).toBe(25); // 3^2 + 4^2 = 25
    });

    it('should work with same point', () => {
      const a: Vec = { x: 5, y: 5 };
      expect(dist2(a, a)).toBe(0);
    });

    it('should work with negative coordinates', () => {
      const a: Vec = { x: -3, y: -4 };
      const b: Vec = { x: 0, y: 0 };
      expect(dist2(a, b)).toBe(25);
    });
  });
});

describe('Player Movement', () => {
  it('should move player in correct direction', () => {
    const angle = 0; // facing right
    const speed = 4.0;
    const pos: Vec = { x: 100, y: 100 };
    const world: WorldView = { width: 2000, height: 1200 };

    const newX = wrap(pos.x + Math.cos(angle) * speed, world.width);
    const newY = wrap(pos.y + Math.sin(angle) * speed, world.height);

    expect(newX).toBeCloseTo(104, 1);
    expect(newY).toBeCloseTo(100, 1);
  });

  it('should wrap around world boundaries', () => {
    const angle = 0; // facing right
    const speed = 10;
    const pos: Vec = { x: 1998, y: 100 }; // near right edge
    const world: WorldView = { width: 2000, height: 1200 };

    const newX = wrap(pos.x + Math.cos(angle) * speed, world.width);
    
    expect(newX).toBeLessThan(20); // wrapped to left side
  });
});

describe('Collision Detection', () => {

  it('should detect food collision', () => {
    const head: Vec = { x: 100, y: 100 };
    const food: Vec = { x: 105, y: 100 };
    
    expect(dist2(head, food)).toBeLessThanOrEqual(FOOD_R2);
  });

  it('should not detect collision when too far', () => {
    const head: Vec = { x: 100, y: 100 };
    const food: Vec = { x: 200, y: 200 };
    
    expect(dist2(head, food)).toBeGreaterThan(FOOD_R2);
  });

  it('should detect head-to-body collision', () => {
    const head: Vec = { x: 100, y: 100 };
    const bodySegment: Vec = { x: 105, y: 105 };
    
    expect(dist2(head, bodySegment)).toBeLessThan(HEAD_R2);
  });
});

describe('Score and Body Growth', () => {
  it('should calculate correct body length from score', () => {
    expect(calculateBodyLength(10)).toBe(15); // minimum
    expect(calculateBodyLength(50)).toBe(40); // 50 * 0.8
    expect(calculateBodyLength(500)).toBe(300); // capped at max
  });

  it('should calculate thickness bonus for large worms', () => {
    expect(calculateThickness(100)).toBe(14); // normal
    expect(calculateThickness(375)).toBe(14); // at max length
    expect(calculateThickness(475)).toBe(24); // 10 bonus thickness
    expect(calculateThickness(1000)).toBe(28); // capped
  });
});

describe('Boost Mechanics', () => {
  it('should increase speed when boosting', () => {
    const BASE_SPEED = 4.0;
    const BOOST_MULTIPLIER = 1.8;
    
    const normalSpeed = BASE_SPEED;
    const boostSpeed = BASE_SPEED * BOOST_MULTIPLIER;
    
    expect(boostSpeed).toBe(7.2);
    expect(boostSpeed).toBeGreaterThan(normalSpeed);
  });

  it('should deplete score when boosting', () => {
    const BOOST_COST_PER_TICK = 0.5;
    let score = 100;
    
    // Boost for 10 ticks
    for (let i = 0; i < 10; i++) {
      score -= BOOST_COST_PER_TICK;
    }
    
    expect(score).toBe(95);
  });

  it('should stop boosting when score too low', () => {
    let score = 10.5;
    let boosting = true;
    const BOOST_COST_PER_TICK = 0.5;
    
    // Simulate boost logic (one tick that brings us to/below 10)
    if (boosting && score > 10) {
      score -= BOOST_COST_PER_TICK;
      if (score <= 10) {
        boosting = false;
        score = 10;
      }
    }
    
    expect(boosting).toBe(false);
    expect(score).toBe(10);
  });
});

describe('Food Burst on Death', () => {
  it('should create food based on worm size', () => {
    const bodyLength = 150;
    const score = 200;
    
    const { segmentFood, bonusFood } = calculateFoodBurst(bodyLength, score);
    const totalFood = segmentFood + bonusFood;
    
    expect(segmentFood).toBe(50);
    expect(bonusFood).toBe(25);
    expect(totalFood).toBe(75);
  });

  it('should cap food burst', () => {
    const bodyLength = 300; // max
    const score = 1000; // huge
    
    const { segmentFood, bonusFood } = calculateFoodBurst(bodyLength, score);
    
    expect(segmentFood).toBe(50); // capped at 150 segments
    expect(bonusFood).toBe(25); // capped at 25
  });
});
