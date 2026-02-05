# FunFun - Multiplayer Platformer Game

A networked 4-player platformer game built with Node.js, Socket.IO, and PostgreSQL. Features server-authoritative physics, real-time multiplayer, and room-based matchmaking.

## Features

- **Real-time Multiplayer**: Up to 4 players per room
- **Server-Authoritative**: All game physics calculated on server
- **Room-Based Matchmaking**: Create or join games using 6-character room codes
- **Client-Side Prediction**: Smooth gameplay with input prediction
- **PostgreSQL Database**: Persistent room and player management

## Architecture

This game follows the client-server architecture principles from [Gabriel Gambetta's Fast-Paced Multiplayer guide](https://www.gabrielgambetta.com/client-server-game-architecture.html):

- **Server Authority**: Server is the source of truth for game state
- **Client Prediction**: Client predicts movement for responsive controls
- **State Synchronization**: Regular state updates from server to clients
- **Input Processing**: Client sends inputs, server processes and validates

## Prerequisites

- Node.js (v14 or higher)
- PostgreSQL (v12 or higher)

## Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd funfun
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up PostgreSQL database**
   
   Create a new PostgreSQL database:
   ```sql
   CREATE DATABASE funfun_game;
   ```

4. **Configure environment variables**
   
   Copy the example environment file:
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` with your database credentials:
   ```
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=funfun_game
   DB_USER=your_postgres_user
   DB_PASSWORD=your_postgres_password
   PORT=3000
   ```

5. **Start the server**
   ```bash
   npm start
   ```

6. **Open the game**
   
   Navigate to `http://localhost:3000` in your browser

## How to Play

1. **Create a Room**: Click "Create Room" to start a new game
2. **Share Room Code**: Share the 6-character room code with friends
3. **Join a Room**: Enter a room code and click "Join Room"
4. **Controls**:
   - Arrow Keys or WASD: Move left/right
   - Space or Up Arrow or W: Jump

## Project Structure

```
funfun/
├── server/
│   ├── database.js      # PostgreSQL database operations
│   └── gameState.js     # Server-authoritative game logic
├── public/
│   ├── index.html       # Game UI
│   ├── css/
│   │   └── style.css    # Styling
│   └── js/
│       └── client.js    # Client-side game logic
├── server.js            # Main server entry point
├── package.json
└── README.md
```

## Technical Details

### Server-Side Components

- **Express**: HTTP server for serving static files
- **Socket.IO**: Real-time bidirectional communication
- **PostgreSQL**: Persistent storage for rooms and players
- **Game Loop**: 60 tick/second physics simulation

### Client-Side Components

- **Canvas Rendering**: 2D game rendering
- **Input Handling**: Keyboard input with sequence numbers
- **State Interpolation**: Smooth rendering of server state

### Game Physics

- Gravity-based platformer mechanics
- Collision detection with platforms
- Velocity-based movement
- Jump mechanics with ground detection

## Future Enhancements

- [ ] Multiple game modes (Deathmatch, Capture the Flag, etc.)
- [ ] Weapon system for shooter mechanics
- [ ] Player authentication and profiles
- [ ] Leaderboards and statistics
- [ ] Advanced matchmaking
- [ ] Power-ups and collectibles
- [ ] Level editor
- [ ] Mobile support

## License

ISC