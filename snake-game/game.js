import {
  GRID_SIZE,
  CELL_SIZE,
  createGame,
  spawnFood,
  changeDirection,
  tick,
  togglePause,
  resetGame,
} from './game-logic.js';

const HIGH_SCORE_KEY = 'snake-high-score';

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const highScoreEl = document.getElementById('high-score');
const speedEl = document.getElementById('speed');
const overlay = document.getElementById('overlay');
const overlayText = document.getElementById('overlay-text');
const finalScoreEl = document.getElementById('final-score');
const pauseBanner = document.getElementById('pause-banner');
const restartBtn = document.getElementById('restart-btn');

let state = spawnFood(createGame());
let highScore = loadHighScore();
let timerId = null;

highScoreEl.textContent = String(highScore);
updateUI();

function loadHighScore() {
  const raw = localStorage.getItem(HIGH_SCORE_KEY);
  const n = parseInt(raw ?? '0', 10);
  return Number.isFinite(n) ? n : 0;
}

function saveHighScore(score) {
  if (score > highScore) {
    highScore = score;
    localStorage.setItem(HIGH_SCORE_KEY, String(highScore));
    highScoreEl.textContent = String(highScore);
  }
}

function speedLabel(tickMs) {
  if (tickMs <= 110) return '极快';
  if (tickMs <= 160) return '快';
  if (tickMs <= 220) return '较快';
  if (tickMs <= 270) return '普通';
  return '悠闲';
}

function updateUI() {
  scoreEl.textContent = String(state.score);
  speedEl.textContent = speedLabel(state.tickMs);

  if (state.gameOver) {
    overlay.classList.remove('hidden');
    pauseBanner.classList.add('hidden');
    overlayText.textContent = state.won ? '恭喜通关！' : '游戏结束';
    finalScoreEl.textContent = `最终得分：${state.score}`;
    saveHighScore(state.score);
    stopLoop();
  } else if (state.paused) {
    pauseBanner.classList.remove('hidden');
    overlay.classList.add('hidden');
  } else {
    pauseBanner.classList.add('hidden');
    overlay.classList.add('hidden');
  }
}

function draw() {
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = '#2a2a4a';
  ctx.lineWidth = 0.5;
  for (let i = 0; i <= GRID_SIZE; i += 1) {
    ctx.beginPath();
    ctx.moveTo(i * CELL_SIZE, 0);
    ctx.lineTo(i * CELL_SIZE, canvas.height);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i * CELL_SIZE);
    ctx.lineTo(canvas.width, i * CELL_SIZE);
    ctx.stroke();
  }

  if (state.food) {
    ctx.fillStyle = '#e94560';
    ctx.beginPath();
    ctx.arc(
      state.food.x * CELL_SIZE + CELL_SIZE / 2,
      state.food.y * CELL_SIZE + CELL_SIZE / 2,
      CELL_SIZE / 2 - 2,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }

  state.snake.forEach((segment, index) => {
    const gradient = ctx.createLinearGradient(
      segment.x * CELL_SIZE,
      segment.y * CELL_SIZE,
      segment.x * CELL_SIZE + CELL_SIZE,
      segment.y * CELL_SIZE + CELL_SIZE,
    );
    if (index === 0) {
      gradient.addColorStop(0, '#4ecca3');
      gradient.addColorStop(1, '#3db88a');
    } else {
      gradient.addColorStop(0, '#3db88a');
      gradient.addColorStop(1, '#2d9a6f');
    }
    ctx.fillStyle = gradient;
    ctx.fillRect(
      segment.x * CELL_SIZE + 1,
      segment.y * CELL_SIZE + 1,
      CELL_SIZE - 2,
      CELL_SIZE - 2,
    );
  });
}

function gameStep() {
  state = tick(state);
  draw();
  updateUI();
  if (!state.gameOver && !state.paused) {
    scheduleNext();
  }
}

function scheduleNext() {
  stopLoop();
  timerId = setTimeout(gameStep, state.tickMs);
}

function startLoop() {
  stopLoop();
  if (!state.gameOver && !state.paused) {
    scheduleNext();
  }
}

function stopLoop() {
  if (timerId !== null) {
    clearTimeout(timerId);
    timerId = null;
  }
}

const keyMap = {
  ArrowUp: 'UP',
  ArrowDown: 'DOWN',
  ArrowLeft: 'LEFT',
  ArrowRight: 'RIGHT',
};

document.addEventListener('keydown', (e) => {
  if (e.code === 'Space') {
    e.preventDefault();
    state = togglePause(state);
    updateUI();
    if (state.paused) {
      stopLoop();
    } else if (!state.gameOver) {
      startLoop();
    }
    return;
  }

  const dir = keyMap[e.key];
  if (dir) {
    e.preventDefault();
    state = changeDirection(state, dir);
    if (!state.gameOver && !state.paused && timerId === null) {
      startLoop();
    }
  }
});

restartBtn.addEventListener('click', () => {
  state = resetGame(state);
  draw();
  updateUI();
  startLoop();
});

draw();
startLoop();
