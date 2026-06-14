import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  GRID_SIZE,
  INITIAL_TICK_MS,
  MIN_TICK_MS,
  createGame,
  spawnFood,
  changeDirection,
  tick,
  togglePause,
  resetGame,
} from './game-logic.js';

describe('createGame', () => {
  it('starts with one segment at center', () => {
    const game = createGame();
    const mid = Math.floor(GRID_SIZE / 2);
    assert.equal(game.snake.length, 1);
    assert.deepEqual(game.snake[0], { x: mid, y: mid });
    assert.equal(game.score, 0);
    assert.equal(game.gameOver, false);
  });

  it('starts with relaxed initial speed', () => {
    const game = createGame();
    assert.equal(game.tickMs, INITIAL_TICK_MS);
    assert.ok(game.tickMs >= 250, `expected tickMs >= 250, got ${game.tickMs}`);
  });
});

describe('changeDirection', () => {
  it('updates next direction', () => {
    let game = createGame();
    game = changeDirection(game, 'UP');
    assert.deepEqual(game.nextDirection, { x: 0, y: -1 });
  });

  it('ignores 180-degree turn when length > 1', () => {
    let game = createGame();
    game = { ...game, snake: [{ x: 5, y: 5 }, { x: 4, y: 5 }], direction: { x: 1, y: 0 }, nextDirection: { x: 1, y: 0 } };
    game = changeDirection(game, 'LEFT');
    assert.deepEqual(game.nextDirection, { x: 1, y: 0 });
  });
});

describe('tick', () => {
  it('moves snake forward', () => {
    let game = createGame();
    const head = { ...game.snake[0] };
    game = tick(game);
    assert.equal(game.snake[0].x, head.x + 1);
    assert.equal(game.snake[0].y, head.y);
  });

  it('grows and scores when eating food', () => {
    let game = createGame();
    const head = game.snake[0];
    game = spawnFood(game, { x: head.x + 1, y: head.y });
    game = tick(game);
    assert.equal(game.snake.length, 2);
    assert.equal(game.score, 10);
  });

  it('ends game on wall collision', () => {
    let game = createGame();
    game = {
      ...game,
      snake: [{ x: GRID_SIZE - 1, y: 10 }],
      direction: { x: 1, y: 0 },
      nextDirection: { x: 1, y: 0 },
      food: { x: 0, y: 0 },
    };
    game = tick(game);
    assert.equal(game.gameOver, true);
  });

  it('ends game on self collision', () => {
    let game = createGame();
    game = {
      ...game,
      snake: [
        { x: 5, y: 5 },
        { x: 5, y: 6 },
        { x: 4, y: 6 },
        { x: 4, y: 5 },
      ],
      direction: { x: 0, y: 1 },
      nextDirection: { x: 0, y: 1 },
      food: { x: 0, y: 0 },
    };
    game = tick(game);
    assert.equal(game.gameOver, true);
  });

  it('accelerates after every 5 foods and respects minimum speed', () => {
    let game = createGame();
    assert.equal(game.tickMs, INITIAL_TICK_MS);

    const head = game.snake[0];
    for (let i = 0; i < 5; i += 1) {
      game = spawnFood(game, { x: head.x + 1 + i, y: head.y });
      game = tick(game);
    }
    assert.equal(game.foodsEaten, 5);
    assert.equal(game.tickMs, INITIAL_TICK_MS - 15);

    game = { ...game, foodsEaten: 95, tickMs: MIN_TICK_MS + 5 };
    game = spawnFood(game, { x: 0, y: 0 });
    game = { ...game, food: { x: game.snake[0].x + 1, y: game.snake[0].y } };
    game = tick(game);
    assert.ok(game.tickMs >= MIN_TICK_MS);
  });
});

describe('togglePause', () => {
  it('toggles paused state', () => {
    let game = createGame();
    game = togglePause(game);
    assert.equal(game.paused, true);
    game = togglePause(game);
    assert.equal(game.paused, false);
  });

  it('does not pause when game over', () => {
    let game = createGame();
    game = { ...game, gameOver: true };
    game = togglePause(game);
    assert.equal(game.paused, false);
  });
});

describe('resetGame', () => {
  it('resets score and snake', () => {
    let game = createGame();
    game = { ...game, score: 100, gameOver: true, snake: [{ x: 1, y: 1 }, { x: 2, y: 1 }] };
    game = resetGame(game);
    assert.equal(game.score, 0);
    assert.equal(game.gameOver, false);
    assert.equal(game.snake.length, 1);
    assert.ok(game.food);
  });
});

describe('spawnFood', () => {
  it('does not place food on snake', () => {
    let game = createGame();
    game = spawnFood(game, { x: 0, y: 0 });
    const onSnake = game.snake.some((s) => s.x === game.food.x && s.y === game.food.y);
    assert.equal(onSnake, false);
  });
});
