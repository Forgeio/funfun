require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');
const db = require('./server/database');
const GameState = require('./server/gameState');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

const PORT = process.env.PORT || 3000;

// Serve static files
app.use(express.static('public'));

// Game state manager
const gameState = new GameState();

// Map to track which room each socket is in
const socketRooms = new Map();

// Game loop intervals per room
const roomIntervals = new Map();

// Start game loop for a room
function startGameLoop(roomCode) {
  if (roomIntervals.has(roomCode)) return; // Already running

  // Simple fixed-rate game loop
  // Note: For production, consider using a fixed timestep loop with interpolation
  // to handle timing drift and ensure consistent physics
  const interval = setInterval(() => {
    const state = gameState.update(roomCode);
    if (state) {
      // Broadcast state to all players in the room
      io.to(roomCode).emit('gameState', state);
    }
  }, 1000 / 60); // 60 updates per second

  roomIntervals.set(roomCode, interval);
}

// Stop game loop for a room
function stopGameLoop(roomCode) {
  const interval = roomIntervals.get(roomCode);
  if (interval) {
    clearInterval(interval);
    roomIntervals.delete(roomCode);
  }
}

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);

  // Handle room creation
  socket.on('createRoom', async (data, callback) => {
    try {
      const roomCode = await db.createRoom();
      const username = data.username || `Player${socket.id.substring(0, 4)}`;
      
      await db.addPlayerToRoom(socket.id, roomCode, username);
      socket.join(roomCode);
      socketRooms.set(socket.id, roomCode);

      // Initialize game state for this room
      gameState.createRoom(roomCode);
      gameState.addPlayer(roomCode, socket.id, username);

      // Start game loop
      startGameLoop(roomCode);

      callback({ success: true, roomCode });
      
      // Notify room of new player
      io.to(roomCode).emit('playerJoined', {
        id: socket.id,
        username
      });

      console.log(`Room ${roomCode} created by ${username}`);
    } catch (error) {
      console.error('Error creating room:', error);
      callback({ success: false, error: error.message });
    }
  });

  // Handle room joining
  socket.on('joinRoom', async (data, callback) => {
    try {
      const { roomCode, username } = data;
      const playerUsername = username || `Player${socket.id.substring(0, 4)}`;
      
      await db.addPlayerToRoom(socket.id, roomCode, playerUsername);
      socket.join(roomCode);
      socketRooms.set(socket.id, roomCode);

      // Add player to game state
      let room = gameState.rooms.get(roomCode);
      if (!room) {
        gameState.createRoom(roomCode);
        startGameLoop(roomCode);
      }
      gameState.addPlayer(roomCode, socket.id, playerUsername);

      const players = await db.getPlayersInRoom(roomCode);
      
      callback({ 
        success: true, 
        roomCode,
        players: players.map(p => ({
          id: p.socket_id,
          username: p.username
        }))
      });

      // Notify room of new player
      io.to(roomCode).emit('playerJoined', {
        id: socket.id,
        username: playerUsername
      });

      console.log(`${playerUsername} joined room ${roomCode}`);
    } catch (error) {
      console.error('Error joining room:', error);
      callback({ success: false, error: error.message });
    }
  });

  // Handle player input
  socket.on('playerInput', (data) => {
    const roomCode = socketRooms.get(socket.id);
    if (roomCode) {
      gameState.updatePlayerInput(roomCode, socket.id, data.inputs, data.sequence);
    }
  });

  // Handle disconnect
  socket.on('disconnect', async () => {
    console.log('Client disconnected:', socket.id);
    
    const roomCode = socketRooms.get(socket.id);
    if (roomCode) {
      try {
        await db.removePlayer(socket.id);
        gameState.removePlayer(roomCode, socket.id);
        
        // Notify room
        io.to(roomCode).emit('playerLeft', { id: socket.id });

        // Check if room is empty
        const players = await db.getPlayersInRoom(roomCode);
        if (players.length === 0) {
          stopGameLoop(roomCode);
          gameState.removeRoom(roomCode);
          console.log(`Room ${roomCode} is empty and has been closed`);
        }

        socketRooms.delete(socket.id);
      } catch (error) {
        console.error('Error handling disconnect:', error);
      }
    }
  });
});

// Initialize database and start server
async function start() {
  try {
    await db.initializeDatabase();
    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Open http://localhost:${PORT} to play`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

start();
