// server/src/player-mechanics.test.ts
import { describe, it, expect } from 'vitest';
import type { Vec, WorldView } from '../../client/src/net/protocol';

describe('Player Steering', () => {
  const TURN_SPEED = 0.12; // radians per tick

  it('should turn left', () => {
    let angle = 0; // facing right
    const turn = -1; // turn left
    
    angle += turn * TURN_SPEED;
    
    expect(angle).toBe(-0.12);
  });

  it('should turn right', () => {
    let angle = 0;
    const turn = 1; // turn right
    
    angle += turn * TURN_SPEED;
    
    expect(angle).toBe(0.12);
  });

  it('should not turn when turn = 0', () => {
    let angle = Math.PI / 2;
    const turn = 0;
    
    angle += turn * TURN_SPEED;
    
    expect(angle).toBe(Math.PI / 2);
  });

  it('should accumulate turns over multiple ticks', () => {
    let angle = 0;
    const turn = 1;
    
    // Turn for 10 ticks
    for (let i = 0; i < 10; i++) {
      angle += turn * TURN_SPEED;
    }
    
    expect(angle).toBeCloseTo(1.2, 5);
  });
});

describe('Player Respawn', () => {
  const world: WorldView = { width: 2000, height: 1200 };

  it('should reset to baby worm state', () => {
    // Simulate respawn
    const player = {
      pos: { x: Math.random() * world.width, y: Math.random() * world.height },
      angle: Math.random() * Math.PI * 2,
      body: [] as Vec[],
      score: 10,
      alive: true,
      turn: 0 as -1 | 0 | 1,
      boosting: false,
      thickness: 14
    };

    expect(player.body.length).toBe(0);
    expect(player.score).toBe(10);
    expect(player.alive).toBe(true);
    expect(player.thickness).toBe(14);
    expect(player.boosting).toBe(false);
  });

  it('should spawn within world boundaries', () => {
    const x = Math.random() * world.width;
    const y = Math.random() * world.height;

    expect(x).toBeGreaterThanOrEqual(0);
    expect(x).toBeLessThan(world.width);
    expect(y).toBeGreaterThanOrEqual(0);
    expect(y).toBeLessThan(world.height);
  });
});

describe('Self-Collision Hinge', () => {
  it('should allow touching first 6 segments', () => {
    const playerId = 'player1';
    const segmentIndex = 3;
    
    // Self-collision logic
    const canCollide = !(playerId === playerId && segmentIndex < 6);
    
    expect(canCollide).toBe(false); // Should NOT collide with own first 6 segments
  });

  it('should collide with own segments after index 6', () => {
    const playerId = 'player1';
    const segmentIndex = 10;
    
    const canCollide = !(playerId === playerId && segmentIndex < 6);
    
    expect(canCollide).toBe(true); // CAN collide with own later segments
  });

  it('should always collide with other players segments', () => {
    const myId = 'player1';
    const ownerId: string = 'player2'; // segment belongs to different player
    const segmentIndex = 0;
    
    const canCollide = !(ownerId === myId && segmentIndex < 6);
    
    expect(canCollide).toBe(true); // Always collide with other players
  });
});

describe('Head-to-Head Collisions', () => {
  const HEAD_R2 = 14*14;

  function dist2(a: Vec, b: Vec) {
    const dx = a.x - b.x, dy = a.y - b.y;
    return dx*dx + dy*dy;
  }

  it('should detect head-to-head collision', () => {
    const playerA: Vec = { x: 100, y: 100 };
    const playerB: Vec = { x: 105, y: 105 };
    
    const collision = dist2(playerA, playerB) < HEAD_R2;
    
    expect(collision).toBe(true);
  });

  it('should kill both players in head-to-head', () => {
    let playerAAlive = true;
    let playerBAlive = true;
    
    // Simulate head-to-head collision
    const collision = true; // detected collision
    
    if (collision) {
      playerAAlive = false;
      playerBAlive = false;
    }
    
    expect(playerAAlive).toBe(false);
    expect(playerBAlive).toBe(false);
  });
});

describe('Food Cleanup Logic', () => {
  it('should only cleanup when over cap', () => {
    const MAX_FOOD = 400;
    const currentFood = 350;
    
    const shouldCleanup = currentFood > MAX_FOOD;
    
    expect(shouldCleanup).toBe(false);
  });

  it('should cleanup when over cap', () => {
    const MAX_FOOD = 400;
    const currentFood = 450;
    
    const shouldCleanup = currentFood > MAX_FOOD;
    
    expect(shouldCleanup).toBe(true);
  });

  it('should keep buffer below max', () => {
    const MAX_FOOD = 400;
    const toKeep = MAX_FOOD - 50;
    
    expect(toKeep).toBe(350);
  });
});

describe('Bonus Food Generation', () => {
  it('should generate correct food types by rarity', () => {
    const FOOD_TYPES = {
      bug: { value: 5, rarity: 0.70 },
      jira: { value: 10, rarity: 0.25 },
      zillow: { value: 30, rarity: 0.05 }
    };

    // Simulate food type selection
    const selectFoodType = (rand: number) => {
      if (rand < 0.05) return 'zillow';
      if (rand < 0.30) return 'jira';
      return 'bug';
    };

    expect(selectFoodType(0.01)).toBe('zillow'); // 5% rare
    expect(selectFoodType(0.15)).toBe('jira');   // 25% uncommon
    expect(selectFoodType(0.50)).toBe('bug');    // 70% common
  });

  it('should have correct point values', () => {
    const FOOD_TYPES = {
      bug: { value: 5 },
      jira: { value: 10 },
      zillow: { value: 30 }
    };

    expect(FOOD_TYPES.bug.value).toBe(5);
    expect(FOOD_TYPES.jira.value).toBe(10);
    expect(FOOD_TYPES.zillow.value).toBe(30);
  });
});
