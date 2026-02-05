// Connect to server
const socket = io();

// Game state
let currentRoomCode = null;
let myPlayerId = null;
let gameActive = false;
let inputSequence = 0;

// Input state
const keys = {
  left: false,
  right: false,
  jump: false
};

// Last received server state
let lastServerState = null;

// Canvas and rendering
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Player colors
const playerColors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A'];
let colorMap = new Map();

// UI Elements
const menuScreen = document.getElementById('menu');
const gameScreen = document.getElementById('game');
const usernameInput = document.getElementById('usernameInput');
const roomCodeInput = document.getElementById('roomCodeInput');
const createRoomBtn = document.getElementById('createRoomBtn');
const joinRoomBtn = document.getElementById('joinRoomBtn');
const leaveRoomBtn = document.getElementById('leaveRoomBtn');
const errorMessage = document.getElementById('errorMessage');
const currentRoomCodeDisplay = document.getElementById('currentRoomCode');
const playerCountDisplay = document.getElementById('playerCount');
const playersListItems = document.getElementById('playersListItems');

// Event Listeners
createRoomBtn.addEventListener('click', createRoom);
joinRoomBtn.addEventListener('click', joinRoom);
leaveRoomBtn.addEventListener('click', leaveRoom);

// Keyboard input
document.addEventListener('keydown', (e) => {
  if (!gameActive) return;
  
  switch(e.key) {
    case 'ArrowLeft':
    case 'a':
    case 'A':
      keys.left = true;
      e.preventDefault();
      break;
    case 'ArrowRight':
    case 'd':
    case 'D':
      keys.right = true;
      e.preventDefault();
      break;
    case 'ArrowUp':
    case 'w':
    case 'W':
    case ' ':
      keys.jump = true;
      e.preventDefault();
      break;
  }
  sendInput();
});

document.addEventListener('keyup', (e) => {
  if (!gameActive) return;
  
  switch(e.key) {
    case 'ArrowLeft':
    case 'a':
    case 'A':
      keys.left = false;
      break;
    case 'ArrowRight':
    case 'd':
    case 'D':
      keys.right = false;
      break;
    case 'ArrowUp':
    case 'w':
    case 'W':
    case ' ':
      keys.jump = false;
      break;
  }
  sendInput();
});

// Functions
function showError(message) {
  errorMessage.textContent = message;
  setTimeout(() => {
    errorMessage.textContent = '';
  }, 5000);
}

function createRoom() {
  const username = usernameInput.value.trim() || null;
  
  socket.emit('createRoom', { username }, (response) => {
    if (response.success) {
      currentRoomCode = response.roomCode;
      myPlayerId = socket.id;
      showGameScreen();
    } else {
      showError(response.error || 'Failed to create room');
    }
  });
}

function joinRoom() {
  const roomCode = roomCodeInput.value.trim().toUpperCase();
  const username = usernameInput.value.trim() || null;
  
  if (!roomCode) {
    showError('Please enter a room code');
    return;
  }
  
  socket.emit('joinRoom', { roomCode, username }, (response) => {
    if (response.success) {
      currentRoomCode = response.roomCode;
      myPlayerId = socket.id;
      showGameScreen();
      updatePlayersList(response.players);
    } else {
      showError(response.error || 'Failed to join room');
    }
  });
}

function leaveRoom() {
  gameActive = false;
  currentRoomCode = null;
  myPlayerId = null;
  colorMap.clear();
  showMenuScreen();
  socket.disconnect();
  socket.connect();
}

function showGameScreen() {
  menuScreen.classList.remove('active');
  gameScreen.classList.add('active');
  currentRoomCodeDisplay.textContent = currentRoomCode;
  gameActive = true;
  
  // Start render loop
  requestAnimationFrame(render);
}

function showMenuScreen() {
  gameScreen.classList.remove('active');
  menuScreen.classList.add('active');
  roomCodeInput.value = '';
}

function sendInput() {
  if (!gameActive) return;
  
  inputSequence++;
  socket.emit('playerInput', {
    inputs: {
      left: keys.left,
      right: keys.right,
      jump: keys.jump
    },
    sequence: inputSequence
  });
}

function updatePlayersList(players) {
  playersListItems.innerHTML = '';
  
  players.forEach((player, index) => {
    const li = document.createElement('li');
    li.textContent = player.username;
    
    // Assign colors
    if (!colorMap.has(player.id)) {
      colorMap.set(player.id, playerColors[index % playerColors.length]);
    }
    
    // Highlight current player
    if (player.id === myPlayerId) {
      li.style.fontWeight = 'bold';
      li.textContent += ' (You)';
    }
    
    li.style.borderLeft = `4px solid ${colorMap.get(player.id)}`;
    playersListItems.appendChild(li);
  });
  
  playerCountDisplay.textContent = players.length;
}

// Render game
function render() {
  if (!gameActive) return;
  
  // Clear canvas
  ctx.fillStyle = '#87CEEB'; // Sky blue
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  if (lastServerState) {
    // Draw platforms
    ctx.fillStyle = '#8B4513'; // Brown
    lastServerState.platforms.forEach(platform => {
      ctx.fillRect(platform.x, platform.y, platform.width, platform.height);
      
      // Add grass on top
      ctx.fillStyle = '#228B22';
      ctx.fillRect(platform.x, platform.y, platform.width, 5);
      ctx.fillStyle = '#8B4513';
    });
    
    // Draw players
    lastServerState.players.forEach((player, index) => {
      // Assign color if not exists
      if (!colorMap.has(player.id)) {
        colorMap.set(player.id, playerColors[index % playerColors.length]);
      }
      
      const color = colorMap.get(player.id);
      
      // Draw player shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      ctx.fillRect(player.x + 2, player.y + 30, 30, 4);
      
      // Draw player
      ctx.fillStyle = color;
      ctx.fillRect(player.x, player.y, 32, 32);
      
      // Draw player outline
      ctx.strokeStyle = player.id === myPlayerId ? '#FFD700' : '#000';
      ctx.lineWidth = player.id === myPlayerId ? 3 : 2;
      ctx.strokeRect(player.x, player.y, 32, 32);
      
      // Draw username
      ctx.fillStyle = '#000';
      ctx.font = '12px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(player.username, player.x + 16, player.y - 5);
    });
  }
  
  requestAnimationFrame(render);
}

// Socket event handlers
socket.on('gameState', (state) => {
  lastServerState = state;
  
  // Update players list if needed
  if (state.players) {
    const players = state.players.map(p => ({
      id: p.id,
      username: p.username
    }));
    updatePlayersList(players);
  }
});

socket.on('playerJoined', (data) => {
  console.log('Player joined:', data.username);
});

socket.on('playerLeft', (data) => {
  console.log('Player left:', data.id);
  colorMap.delete(data.id);
});

socket.on('connect', () => {
  console.log('Connected to server');
});

socket.on('disconnect', () => {
  console.log('Disconnected from server');
  if (gameActive) {
    showError('Connection lost. Please refresh the page.');
  }
});
