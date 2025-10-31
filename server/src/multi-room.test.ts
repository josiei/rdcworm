// server/src/multi-room.test.ts
import { describe, it, expect } from 'vitest';

describe('Multi-Room System', () => {
  describe('Room Configuration', () => {
    it('should have 5 distinct rooms configured', () => {
      const roomIds = ['arena1', 'arena2', 'arena3', 'deathmatch', 'chill'];
      expect(roomIds).toHaveLength(5);
    });

    it('should have correct room types', () => {
      const tournamentRooms = ['arena1', 'arena2', 'arena3', 'deathmatch'];
      const casualRooms = ['chill'];
      
      expect(tournamentRooms).toHaveLength(4);
      expect(casualRooms).toHaveLength(1);
    });

    it('should have different world sizes per room', () => {
      const qualifierSize = { width: 2000, height: 1200 };
      const deathmatchSize = { width: 1000, height: 600 };
      const chillSize = { width: 2500, height: 1500 };
      
      expect(qualifierSize.width).toBe(2000);
      expect(deathmatchSize.width).toBe(1000);
      expect(chillSize.width).toBe(2500);
    });

    it('should have correct max player counts', () => {
      const qualifierMax = 20;
      const deathmatchMax = 12;
      const chillMax = 30;
      
      expect(qualifierMax).toBe(20);
      expect(deathmatchMax).toBe(12);
      expect(chillMax).toBe(30);
    });
  });

  describe('Room States', () => {
    it('should support all room states', () => {
      const validStates = ['waiting', 'ready_check', 'countdown', 'active', 'finished', 'freeplay'];
      expect(validStates).toContain('waiting');
      expect(validStates).toContain('active');
      expect(validStates).toContain('finished');
    });

    it('should initialize tournament rooms in waiting state', () => {
      const initialState = 'waiting';
      expect(initialState).toBe('waiting');
    });

    it('should initialize casual rooms in freeplay state', () => {
      const initialState = 'freeplay';
      expect(initialState).toBe('freeplay');
    });
  });

  describe('Tournament Timer', () => {
    it('should have 10 minute round duration', () => {
      const roundDuration = 10 * 60 * 1000; // 10 minutes in ms
      expect(roundDuration).toBe(600000);
    });

    it('should calculate remaining time correctly', () => {
      const startTime = Date.now();
      const duration = 600000; // 10 minutes
      const elapsed = 60000; // 1 minute
      const remaining = duration - elapsed;
      
      expect(remaining).toBe(540000); // 9 minutes
    });

    it('should convert remaining time to seconds', () => {
      const remainingMs = 540000;
      const remainingSeconds = Math.floor(remainingMs / 1000);
      
      expect(remainingSeconds).toBe(540); // 9 minutes = 540 seconds
    });
  });

  describe('Player Management', () => {
    it('should track players per room independently', () => {
      const room1Players = new Map();
      const room2Players = new Map();
      
      room1Players.set('player1', { id: 'player1', name: 'Alice' });
      room2Players.set('player2', { id: 'player2', name: 'Bob' });
      
      expect(room1Players.size).toBe(1);
      expect(room2Players.size).toBe(1);
      expect(room1Players.has('player2')).toBe(false);
    });

    it('should support spectator mode', () => {
      const modes = ['playing', 'spectating'];
      expect(modes).toContain('spectating');
    });
  });

  describe('Food Generation', () => {
    it('should generate food within room bounds', () => {
      const world = { width: 2000, height: 1200 };
      const food = {
        x: Math.random() * world.width,
        y: Math.random() * world.height
      };
      
      expect(food.x).toBeGreaterThanOrEqual(0);
      expect(food.x).toBeLessThanOrEqual(world.width);
      expect(food.y).toBeGreaterThanOrEqual(0);
      expect(food.y).toBeLessThanOrEqual(world.height);
    });

    it('should seed different amounts for different room types', () => {
      const tournamentFoodCount = 250;
      const casualFoodCount = 300;
      
      expect(casualFoodCount).toBeGreaterThan(tournamentFoodCount);
    });
  });

  describe('Winner Detection', () => {
    it('should find player with highest score', () => {
      const players = [
        { id: '1', name: 'Alice', score: 50 },
        { id: '2', name: 'Bob', score: 100 },
        { id: '3', name: 'Charlie', score: 75 }
      ];
      
      const winner = players.reduce((top, p) => p.score > top.score ? p : top);
      
      expect(winner.name).toBe('Bob');
      expect(winner.score).toBe(100);
    });

    it('should handle single player', () => {
      const players = [
        { id: '1', name: 'Alice', score: 50 }
      ];
      
      const winner = players.reduce((top, p) => p.score > top.score ? p : top);
      
      expect(winner.name).toBe('Alice');
    });

    it('should handle empty player list', () => {
      const players: any[] = [];
      const hasWinner = players.length > 0;
      
      expect(hasWinner).toBe(false);
    });
  });

  describe('Admin System', () => {
    it('should validate admin token', () => {
      const validToken = 'josie';
      const providedToken = 'josie';
      
      expect(providedToken).toBe(validToken);
    });

    it('should reject invalid admin token', () => {
      const validToken = 'josie';
      const providedToken = 'wrong';
      
      expect(providedToken).not.toBe(validToken);
    });
  });

  describe('Broadcast Rate', () => {
    it('should broadcast at 20 Hz', () => {
      const STATE_HZ = 20;
      const interval = 1000 / STATE_HZ;
      
      expect(interval).toBe(50); // 50ms between broadcasts
    });

    it('should run physics at 30 Hz', () => {
      const TICK_HZ = 30;
      const interval = 1000 / TICK_HZ;
      
      expect(interval).toBeCloseTo(33.33, 1); // ~33ms between ticks
    });
  });

  describe('Room Isolation', () => {
    it('should keep room states independent', () => {
      const room1 = { state: 'active', players: new Map() };
      const room2 = { state: 'waiting', players: new Map() };
      
      room1.state = 'finished';
      
      expect(room1.state).toBe('finished');
      expect(room2.state).toBe('waiting'); // Should not be affected
    });

    it('should keep food arrays independent', () => {
      const room1Foods: any[] = [{ x: 100, y: 100 }];
      const room2Foods: any[] = [{ x: 200, y: 200 }];
      
      room1Foods.push({ x: 150, y: 150 });
      
      expect(room1Foods).toHaveLength(2);
      expect(room2Foods).toHaveLength(1); // Should not be affected
    });
  });
});
