// Server-authoritative game state manager
class GameState {
  constructor() {
    // Store game states per room
    this.rooms = new Map();
    
    // Game configuration
    this.config = {
      mapWidth: 1600,
      mapHeight: 900,
      gravity: 0.8,
      jumpStrength: -15,
      moveSpeed: 5,
      playerSize: 32,
      tickRate: 60, // Server updates per second
      platforms: [
        { x: 0, y: 850, width: 1600, height: 50 }, // Ground
        { x: 400, y: 650, width: 300, height: 20 },
        { x: 900, y: 500, width: 300, height: 20 },
        { x: 200, y: 400, width: 200, height: 20 },
        { x: 1100, y: 400, width: 200, height: 20 },
      ]
    };
  }

  // Create a new room state
  createRoom(roomCode) {
    this.rooms.set(roomCode, {
      players: new Map(),
      lastUpdateTime: Date.now(),
      tickCount: 0
    });
  }

  // Remove room state
  removeRoom(roomCode) {
    this.rooms.delete(roomCode);
  }

  // Add player to room
  addPlayer(roomCode, socketId, username) {
    const room = this.rooms.get(roomCode);
    if (!room) return;

    const spawnPositions = [
      { x: 100, y: 700 },
      { x: 300, y: 700 },
      { x: 500, y: 700 },
      { x: 700, y: 700 }
    ];

    const playerIndex = room.players.size;
    const spawnPos = spawnPositions[playerIndex % spawnPositions.length];

    room.players.set(socketId, {
      id: socketId,
      username: username || `Player${playerIndex + 1}`,
      x: spawnPos.x,
      y: spawnPos.y,
      vx: 0,
      vy: 0,
      width: this.config.playerSize,
      height: this.config.playerSize,
      grounded: false,
      inputs: {
        left: false,
        right: false,
        jump: false
      },
      lastInputSeq: 0
    });
  }

  // Remove player from room
  removePlayer(roomCode, socketId) {
    const room = this.rooms.get(roomCode);
    if (!room) return;
    room.players.delete(socketId);
  }

  // Update player input
  updatePlayerInput(roomCode, socketId, inputs, sequence) {
    const room = this.rooms.get(roomCode);
    if (!room) return;
    
    const player = room.players.get(socketId);
    if (!player) return;

    // Only accept newer inputs (sequence number should increase)
    if (sequence > player.lastInputSeq) {
      player.inputs = inputs;
      player.lastInputSeq = sequence;
    }
  }

  // Physics: Check collision with platforms
  checkPlatformCollision(player, platform) {
    return (
      player.x < platform.x + platform.width &&
      player.x + player.width > platform.x &&
      player.y < platform.y + platform.height &&
      player.y + player.height > platform.y
    );
  }

  // Update game physics for a single player
  updatePlayerPhysics(player) {
    // Note: deltaTime parameter removed as we're using fixed timestep
    // All physics calculations assume 60 ticks/second for consistency
    
    // Apply horizontal movement
    if (player.inputs.left) {
      player.vx = -this.config.moveSpeed;
    } else if (player.inputs.right) {
      player.vx = this.config.moveSpeed;
    } else {
      player.vx = 0;
    }

    // Apply gravity
    player.vy += this.config.gravity;

    // Apply velocity
    player.x += player.vx;
    player.y += player.vy;

    // Check ground collision
    player.grounded = false;
    for (const platform of this.config.platforms) {
      if (this.checkPlatformCollision(player, platform)) {
        // Collision detected - resolve it
        const overlapLeft = (player.x + player.width) - platform.x;
        const overlapRight = (platform.x + platform.width) - player.x;
        const overlapTop = (player.y + player.height) - platform.y;
        const overlapBottom = (platform.y + platform.height) - player.y;

        const minOverlap = Math.min(overlapLeft, overlapRight, overlapTop, overlapBottom);

        if (minOverlap === overlapTop && player.vy > 0) {
          // Landing on platform from above
          player.y = platform.y - player.height;
          player.vy = 0;
          player.grounded = true;
          
          // Handle jump
          if (player.inputs.jump) {
            player.vy = this.config.jumpStrength;
            player.grounded = false;
          }
        } else if (minOverlap === overlapBottom && player.vy < 0) {
          // Hit platform from below
          player.y = platform.y + platform.height;
          player.vy = 0;
        } else if (minOverlap === overlapLeft) {
          player.x = platform.x - player.width;
        } else if (minOverlap === overlapRight) {
          player.x = platform.x + platform.width;
        }
      }
    }

    // Boundary checks
    if (player.x < 0) player.x = 0;
    if (player.x + player.width > this.config.mapWidth) {
      player.x = this.config.mapWidth - player.width;
    }
    if (player.y > this.config.mapHeight) {
      player.y = this.config.mapHeight - player.height;
      player.vy = 0;
    }
  }

  // Update game state for a room
  update(roomCode) {
    const room = this.rooms.get(roomCode);
    if (!room) return null;

    const now = Date.now();
    room.lastUpdateTime = now;
    room.tickCount++;

    // Update all players with fixed timestep physics
    for (const [socketId, player] of room.players) {
      this.updatePlayerPhysics(player);
    }

    return this.getState(roomCode);
  }

  // Get current state of a room
  getState(roomCode) {
    const room = this.rooms.get(roomCode);
    if (!room) return null;

    return {
      tick: room.tickCount,
      timestamp: room.lastUpdateTime,
      players: Array.from(room.players.values()).map(p => ({
        id: p.id,
        username: p.username,
        x: p.x,
        y: p.y,
        vx: p.vx,
        vy: p.vy,
        grounded: p.grounded
      })),
      platforms: this.config.platforms
    };
  }
}

module.exports = GameState;
