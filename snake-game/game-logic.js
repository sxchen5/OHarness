export const GRID_SIZE = 20;
export const CELL_SIZE = 20;
export const SCORE_PER_FOOD = 10;
export const INITIAL_TICK_MS = 280;
export const MIN_TICK_MS = 100;
export const SPEED_STEP_MS = 15;

/**
 * @returns {import('./game-types.js').GameState}
 */
export function createGame(gridSize = GRID_SIZE) {
  const mid = Math.floor(gridSize / 2);
  return {
    gridSize,
    snake: [{ x: mid, y: mid }],
    direction: { x: 1, y: 0 },
    nextDirection: { x: 1, y: 0 },
    food: null,
    score: 0,
    gameOver: false,
    paused: false,
    foodsEaten: 0,
    tickMs: INITIAL_TICK_MS,
    won: false,
  };
}

/**
 * @param {import('./game-types.js').GameState} state
 * @param {{ x: number, y: number } | null} [foodPosition]
 */
export function spawnFood(state, foodPosition = null) {
  const occupied = new Set(state.snake.map((s) => `${s.x},${s.y}`));
  const free = [];
  for (let x = 0; x < state.gridSize; x += 1) {
    for (let y = 0; y < state.gridSize; y += 1) {
      if (!occupied.has(`${x},${y}`)) {
        free.push({ x, y });
      }
    }
  }
  if (free.length === 0) {
    return { ...state, gameOver: true, won: true };
  }
  const food = foodPosition ?? free[Math.floor(Math.random() * free.length)];
  if (occupied.has(`${food.x},${food.y}`)) {
    return spawnFood(state, null);
  }
  return { ...state, food };
}

/**
 * @param {import('./game-types.js').GameState} state
 * @param {'UP'|'DOWN'|'LEFT'|'RIGHT'} dir
 */
export function changeDirection(state, dir) {
  const dirs = {
    UP: { x: 0, y: -1 },
    DOWN: { x: 0, y: 1 },
    LEFT: { x: -1, y: 0 },
    RIGHT: { x: 1, y: 0 },
  };
  const newDir = dirs[dir];
  if (!newDir) return state;
  const cur = state.direction;
  if (cur.x + newDir.x === 0 && cur.y + newDir.y === 0 && state.snake.length > 1) {
    return state;
  }
  return { ...state, nextDirection: newDir };
}

/**
 * @param {import('./game-types.js').GameState} state
 */
export function tick(state) {
  if (state.gameOver || state.paused) return state;

  const direction = state.nextDirection;
  const head = state.snake[0];
  const newHead = { x: head.x + direction.x, y: head.y + direction.y };

  if (newHead.x < 0 || newHead.x >= state.gridSize || newHead.y < 0 || newHead.y >= state.gridSize) {
    return { ...state, direction, gameOver: true };
  }

  const ate = state.food && newHead.x === state.food.x && newHead.y === state.food.y;
  const newSnake = [newHead, ...state.snake];
  if (!ate) {
    newSnake.pop();
  }

  for (let i = 1; i < newSnake.length; i += 1) {
    if (newSnake[i].x === newHead.x && newSnake[i].y === newHead.y) {
      return { ...state, snake: newSnake, direction, gameOver: true };
    }
  }

  let next = {
    ...state,
    snake: newSnake,
    direction,
    score: ate ? state.score + SCORE_PER_FOOD : state.score,
    foodsEaten: ate ? state.foodsEaten + 1 : state.foodsEaten,
    tickMs:
      ate && (state.foodsEaten + 1) % 5 === 0
        ? Math.max(MIN_TICK_MS, state.tickMs - SPEED_STEP_MS)
        : state.tickMs,
  };

  if (ate) {
    next = spawnFood(next);
  }
  return next;
}

/**
 * @param {import('./game-types.js').GameState} state
 */
export function togglePause(state) {
  if (state.gameOver) return state;
  return { ...state, paused: !state.paused };
}

/**
 * @param {import('./game-types.js').GameState} state
 */
export function resetGame(state) {
  const fresh = createGame(state.gridSize);
  return spawnFood(fresh);
}
