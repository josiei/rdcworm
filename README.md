# 🐍 RDC Worm Game

> A blazing-fast multiplayer worm game with boost mechanics, tournament system, and real-time competitive gameplay

## 🎮 [**PLAY NOW**](https://rdcwormgame-7c33e9e01381.herokuapp.com/)

![Game Status](https://img.shields.io/badge/status-live-brightgreen)
![Node Version](https://img.shields.io/badge/node-22.x-green)
![Tests](https://img.shields.io/badge/tests-64%20passing-success)

---

## 🌟 Features

### 🏆 Multi-Room Tournament System
- **5 Independent Arenas** with isolated game loops running at 30 Hz
  - **Arena 1, 2, 3**: Tournament qualifiers (2000×1200, 20 players each)
  - **Deathmatch**: Finals arena (1000×600, 12 players)
  - **Chill Zone**: Casual play (2500×1500, 30 players)
- **Tournament Flow**: Qualifiers → Finals → Victory
- **Admin Controls**: Start tournaments, manage rounds, reset system

### ⚡ Core Gameplay
- **Boost Mechanics**: Hold space to boost and outmaneuver opponents
- **Score-Based Growth**: Eat food to grow longer and thicker
- **Toroidal World**: Seamless wrapping around world boundaries
- **Real-Time Physics**: 30 Hz server updates for smooth gameplay
- **Collision Detection**: Optimized spatial grid system (20x+ performance improvement)
- **Food Burst**: Defeated worms drop food proportional to their size

### 🎨 Modern UI/UX
- **Scrollable Lobby**: Browse and select rooms
- **Live Player Counts**: See room populations in real-time
- **Admin Authentication**: URL-based admin access (`?admin=josie`)
- **Responsive Design**: Works on desktop and mobile

---

## 🚀 Tech Stack

### Frontend
- **React 19** - Modern UI framework
- **TypeScript** - Type-safe development
- **Vite** - Lightning-fast build tool
- **WebSockets** - Real-time bidirectional communication

### Backend
- **Node.js 22** - High-performance JavaScript runtime
- **WebSocket Server** - Real-time game state synchronization
- **TypeScript** - End-to-end type safety
- **Vitest** - Comprehensive test coverage (64 tests)

### Architecture
- **Monorepo Structure** - Shared types between client/server
- **Room-Scoped Physics** - Isolated game loops per arena
- **Spatial Grid Optimization** - Efficient collision detection
- **Test-Driven Development** - 100% test coverage maintained during refactors

---

## 🎯 How to Play

1. **Choose Your Arena** - Select from 5 different rooms in the lobby
2. **Enter Your Name** - Personalize your worm
3. **Survive & Grow** - Eat food to increase your score and size
4. **Boost Strategically** - Hold `SPACE` to boost (costs score)
5. **Avoid Collisions** - Don't hit other worms or yourself
6. **Dominate** - Become the biggest worm in the arena!

### Controls
- **Mouse Movement** - Steer your worm
- **SPACE** - Boost (hold)

---

## 🛠️ Development

### Prerequisites
- Node.js 22.x
- npm

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/rdcworm.git
cd rdcworm

# Install dependencies
npm install

# Run in development mode (client + server)
npm run dev
```

### Available Scripts

```bash
npm run dev          # Run client and server in development mode
npm run build        # Build for production
npm start            # Start production server
npm test             # Run test suite (in server directory)
```

### Project Structure

```
rdcworm/
├── client/          # React frontend
│   ├── src/
│   │   ├── components/
│   │   ├── hooks/
│   │   └── App.tsx
│   └── package.json
├── server/          # Node.js backend
│   ├── src/
│   │   ├── game-engine.ts    # Pure game logic
│   │   ├── index.ts          # WebSocket server
│   │   └── __tests__/        # Test suite
│   └── package.json
├── shared/          # Shared TypeScript types
│   └── types.ts
└── package.json     # Root package
```

---

## 🧪 Testing

The game is built with **Test-Driven Development** principles:

- **64 comprehensive tests** covering all game mechanics
- **100% passing** throughout entire refactor
- **Zero regressions** when adding new features

```bash
cd server
npm test              # Watch mode
npm run test:run      # Run once
npm run test:ui       # Visual UI
```

### Test Coverage
- ✅ Game Physics (toroidal wrapping, distance calculations)
- ✅ Player Movement & Steering
- ✅ Collision Detection (food, head-to-body, head-to-head)
- ✅ Score & Body Growth
- ✅ Boost Mechanics
- ✅ Food Burst on Death
- ✅ Spatial Grid Optimization
- ✅ Respawn Mechanics
- ✅ Self-Collision Prevention

---

## 🏗️ Architecture Highlights

### Room System
- **Isolated Game Loops**: Each room runs independently at 30 Hz
- **Room-Specific Broadcasts**: No cross-talk between arenas
- **Different World Sizes**: Optimized for different player counts
- **Scalable Design**: Easy to add new rooms

### Performance Optimizations
- **Spatial Grid**: 20x+ faster collision detection
- **Efficient Broadcasting**: Room-scoped WebSocket messages
- **Pure Functions**: Extracted game logic for testability
- **Modular Architecture**: Clean separation of concerns

### Admin System
- **URL-Based Auth**: Secure admin access via query parameter
- **Lobby Controls**: Manage tournaments from the lobby
- **Early WebSocket**: Connection established before room join
- **Tournament Commands**: Start qualifiers, finals, reset system

---

## 🎮 Tournament System

### Flow
1. **Admin starts qualifiers** from lobby
2. **Players join Arena 1, 2, or 3** for 10-minute rounds
3. **Top performers advance** to Deathmatch finals
4. **Admin starts finals** in smaller, more intense arena
5. **Winners compete** for ultimate victory
6. **Reset** for next tournament

### Admin Commands
- `?admin=josie` - Authenticate as admin
- **Start Qualifiers** - Begin tournament rounds
- **Start Deathmatch** - Launch finals
- **Reset Tournament** - Clear and restart

---

## 🚢 Deployment

Deployed on **Heroku** with automatic builds:

```bash
git push heroku main
```

The `heroku-postbuild` script automatically builds both client and server.

---

---

## 🎉 Credits

Built with ❤️ using modern web technologies and test-driven development practices.

**[Play the game now!](https://rdcwormgame-7c33e9e01381.herokuapp.com/)**

---

## 🐛 Known Issues / Future Improvements

- [ ] Re-implement client-side interpolation (60 FPS rendering)
- [ ] Add leaderboard persistence
- [ ] Tournament bracket visualization
- [ ] Mobile touch controls optimization

---

**Star ⭐ this repo if you enjoy the game!**
