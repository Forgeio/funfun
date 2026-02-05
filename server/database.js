const { Pool } = require('pg');

// PostgreSQL connection pool
const poolConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'funfun_game',
  user: process.env.DB_USER || 'postgres',
};

// Only add password if it's provided
if (process.env.DB_PASSWORD) {
  poolConfig.password = process.env.DB_PASSWORD;
}

const pool = new Pool(poolConfig);

// Initialize database schema
async function initializeDatabase() {
  const client = await pool.connect();
  try {
    // Create rooms table
    await client.query(`
      CREATE TABLE IF NOT EXISTS rooms (
        id SERIAL PRIMARY KEY,
        room_code VARCHAR(6) UNIQUE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        max_players INTEGER DEFAULT 4,
        is_active BOOLEAN DEFAULT true
      )
    `);

    // Create players table
    await client.query(`
      CREATE TABLE IF NOT EXISTS players (
        id SERIAL PRIMARY KEY,
        socket_id VARCHAR(255) UNIQUE NOT NULL,
        room_code VARCHAR(6) REFERENCES rooms(room_code),
        username VARCHAR(50),
        joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('Database schema initialized successfully');
  } catch (err) {
    console.error('Error initializing database:', err);
  } finally {
    client.release();
  }
}

// Generate random 6-character room code
function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Create a new room
async function createRoom() {
  const MAX_ROOM_CODE_GENERATION_ATTEMPTS = 10;
  const client = await pool.connect();
  try {
    let roomCode;
    let created = false;
    let attempts = 0;
    
    while (!created && attempts < MAX_ROOM_CODE_GENERATION_ATTEMPTS) {
      roomCode = generateRoomCode();
      try {
        const result = await client.query(
          'INSERT INTO rooms (room_code) VALUES ($1) RETURNING room_code',
          [roomCode]
        );
        created = true;
        return result.rows[0].room_code;
      } catch (err) {
        if (err.code === '23505') { // Unique constraint violation
          attempts++;
        } else {
          throw err;
        }
      }
    }
    throw new Error('Failed to generate unique room code');
  } finally {
    client.release();
  }
}

// Add player to room
async function addPlayerToRoom(socketId, roomCode, username) {
  const client = await pool.connect();
  try {
    // Check if room exists and has space
    const roomResult = await client.query(
      'SELECT max_players FROM rooms WHERE room_code = $1 AND is_active = true',
      [roomCode]
    );
    
    if (roomResult.rows.length === 0) {
      throw new Error('Room not found');
    }
    
    const playerCountResult = await client.query(
      'SELECT COUNT(*) as count FROM players WHERE room_code = $1',
      [roomCode]
    );
    
    const currentPlayers = parseInt(playerCountResult.rows[0].count);
    const maxPlayers = roomResult.rows[0].max_players;
    
    if (currentPlayers >= maxPlayers) {
      throw new Error('Room is full');
    }
    
    await client.query(
      'INSERT INTO players (socket_id, room_code, username) VALUES ($1, $2, $3)',
      [socketId, roomCode, username]
    );
    
    return true;
  } finally {
    client.release();
  }
}

// Remove player from room
async function removePlayer(socketId) {
  const client = await pool.connect();
  try {
    await client.query('DELETE FROM players WHERE socket_id = $1', [socketId]);
  } finally {
    client.release();
  }
}

// Get players in a room
async function getPlayersInRoom(roomCode) {
  const result = await pool.query(
    'SELECT socket_id, username FROM players WHERE room_code = $1',
    [roomCode]
  );
  return result.rows;
}

module.exports = {
  initializeDatabase,
  createRoom,
  addPlayerToRoom,
  removePlayer,
  getPlayersInRoom,
  pool
};
