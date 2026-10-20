(() => {
  "use strict";

  const canvas = document.getElementById("game-canvas");
  const context = canvas.getContext("2d");
  const scoreElement = document.getElementById("score");
  const highScoreElement = document.getElementById("high-score");
  const statusElement = document.getElementById("status");
  const restartButton = document.getElementById("restart-button");

  const BOARD_SIZE = 600;
  const CELL_SIZE = 20;
  const CELL_COUNT = BOARD_SIZE / CELL_SIZE;
  const MOVE_INTERVAL = 120;
  const SCORE_PER_FOOD = 10;
  const BOMB_COUNT = 5;
  const BOMB_RELOCATE_INTERVAL = 3600;
  const BOMB_MIN_HEAD_DISTANCE = 4;
  const HIGH_SCORE_KEY = "neon-snake-high-score";

  const DIRECTIONS = {
    ArrowUp: { x: 0, y: -1 },
    ArrowDown: { x: 0, y: 1 },
    ArrowLeft: { x: -1, y: 0 },
    ArrowRight: { x: 1, y: 0 },
  };

  let snake;
  let food;
  let direction;
  let nextDirection;
  let score;
  let highScore = readHighScore();
  let bombs;
  let paused = false;
  let gameOver = false;
  let gameOverReason = "";
  let accumulator = 0;
  let bombAccumulator = 0;
  let previousTime = 0;

  function readHighScore() {
    try {
      const storedValue = Number.parseInt(
        window.localStorage.getItem(HIGH_SCORE_KEY) || "0",
        10,
      );
      return Number.isFinite(storedValue) && storedValue > 0
        ? storedValue
        : 0;
    } catch {
      return 0;
    }
  }

  function saveHighScore() {
    try {
      window.localStorage.setItem(HIGH_SCORE_KEY, String(highScore));
    } catch {
      // The game still works when local storage is unavailable.
    }
  }

  function resetGame() {
    snake = [
      { x: 10, y: 15 },
      { x: 9, y: 15 },
      { x: 8, y: 15 },
    ];
    direction = { x: 1, y: 0 };
    nextDirection = { x: 1, y: 0 };
    score = 0;
    bombs = [];
    paused = false;
    gameOver = false;
    gameOverReason = "";
    accumulator = 0;
    bombAccumulator = 0;
    previousTime = 0;
    food = createFood();
    bombs = createBombs();
    updateHud();
    draw();
  }

  function createFood() {
    const openCells = [];

    for (let y = 0; y < CELL_COUNT; y += 1) {
      for (let x = 0; x < CELL_COUNT; x += 1) {
        const occupied =
          snake.some(
            (segment) => segment.x === x && segment.y === y,
          ) ||
          bombs.some((bomb) => bomb.x === x && bomb.y === y);

        if (!occupied) {
          openCells.push({ x, y });
        }
      }
    }

    if (openCells.length === 0) {
      endGame(true);
      return null;
    }

    return openCells[Math.floor(Math.random() * openCells.length)];
  }

  function createBombs() {
    const head = snake[0];
    const candidates = [];

    for (let y = 0; y < CELL_COUNT; y += 1) {
      for (let x = 0; x < CELL_COUNT; x += 1) {
        const occupiedBySnake = snake.some(
          (segment) => segment.x === x && segment.y === y,
        );
        const occupiedByFood = food && food.x === x && food.y === y;
        const closeToHead =
          Math.abs(x - head.x) + Math.abs(y - head.y) <
          BOMB_MIN_HEAD_DISTANCE;

        if (!occupiedBySnake && !occupiedByFood && !closeToHead) {
          candidates.push({ x, y });
        }
      }
    }

    for (let index = candidates.length - 1; index > 0; index -= 1) {
      const randomIndex = Math.floor(Math.random() * (index + 1));
      [candidates[index], candidates[randomIndex]] = [
        candidates[randomIndex],
        candidates[index],
      ];
    }

    return candidates.slice(0, BOMB_COUNT);
  }

  function relocateBombs() {
    bombs = createBombs();
  }

  function setDirection(candidate) {
    if (
      gameOver ||
      paused ||
      (candidate.x === direction.x && candidate.y === direction.y)
    ) {
      return;
    }

    const isReverse =
      candidate.x === -direction.x && candidate.y === -direction.y;

    if (!isReverse) {
      nextDirection = candidate;
    }
  }

  function update() {
    direction = nextDirection;

    const head = snake[0];
    const nextHead = {
      x: head.x + direction.x,
      y: head.y + direction.y,
    };

    const hitWall =
      nextHead.x < 0 ||
      nextHead.x >= CELL_COUNT ||
      nextHead.y < 0 ||
      nextHead.y >= CELL_COUNT;

    if (hitWall) {
      endGame("撞到了边界");
      return;
    }

    const hitBomb = bombs.some(
      (bomb) => bomb.x === nextHead.x && bomb.y === nextHead.y,
    );

    if (hitBomb) {
      endGame("踩到了炸弹");
      return;
    }

    const ateFood =
      food && nextHead.x === food.x && nextHead.y === food.y;
    const bodyToCheck = ateFood ? snake : snake.slice(0, -1);
    const hitSelf = bodyToCheck.some(
      (segment) =>
        segment.x === nextHead.x && segment.y === nextHead.y,
    );

    if (hitSelf) {
      endGame("撞到了自己");
      return;
    }

    snake.unshift(nextHead);

    if (ateFood) {
      score += SCORE_PER_FOOD;
      highScore = Math.max(highScore, score);
      saveHighScore();
      food = createFood();

      if (!gameOver) {
        updateHud();
      }
    } else {
      snake.pop();
    }
  }

  function endGame(reason = "游戏结束") {
    if (gameOver) {
      return;
    }

    gameOver = true;
    gameOverReason = reason;
    highScore = Math.max(highScore, score);
    saveHighScore();
    updateHud();
  }

  function updateHud() {
    scoreElement.textContent = String(score);
    highScoreElement.textContent = String(highScore);

    if (gameOver) {
      statusElement.dataset.state = "over";
      statusElement.innerHTML =
        '<span class="status-dot" aria-hidden="true"></span>游戏结束';
    } else if (paused) {
      statusElement.dataset.state = "paused";
      statusElement.innerHTML =
        '<span class="status-dot" aria-hidden="true"></span>游戏已暂停';
    } else {
      statusElement.dataset.state = "playing";
      statusElement.innerHTML =
        '<span class="status-dot" aria-hidden="true"></span>游戏进行中';
    }
  }

  function draw() {
    drawBoard();

    if (food) {
      drawFood(food);
    }

    drawBombs();
    drawSnake();

    if (paused) {
      drawOverlay("已暂停", "按空格继续游戏");
    } else if (gameOver) {
      drawOverlay(
        "游戏结束",
        `${gameOverReason} · 最终得分 ${score} · 按 R 重新开始`,
      );
    }
  }

  function drawBoard() {
    context.clearRect(0, 0, BOARD_SIZE, BOARD_SIZE);

    const backgroundGradient = context.createRadialGradient(
      BOARD_SIZE / 2,
      BOARD_SIZE / 2,
      40,
      BOARD_SIZE / 2,
      BOARD_SIZE / 2,
      BOARD_SIZE * 0.72,
    );
    backgroundGradient.addColorStop(0, "#0d1a24");
    backgroundGradient.addColorStop(1, "#081018");
    context.fillStyle = backgroundGradient;
    context.fillRect(0, 0, BOARD_SIZE, BOARD_SIZE);

    context.strokeStyle = "rgba(132, 180, 174, 0.055)";
    context.lineWidth = 1;
    context.beginPath();

    for (let position = CELL_SIZE; position < BOARD_SIZE; position += CELL_SIZE) {
      context.moveTo(position + 0.5, 0);
      context.lineTo(position + 0.5, BOARD_SIZE);
      context.moveTo(0, position + 0.5);
      context.lineTo(BOARD_SIZE, position + 0.5);
    }

    context.stroke();
  }

  function drawSnake() {
    snake.forEach((segment, index) => {
      const padding = index === 0 ? 2 : 2.5;
      const x = segment.x * CELL_SIZE + padding;
      const y = segment.y * CELL_SIZE + padding;
      const size = CELL_SIZE - padding * 2;

      context.save();

      if (index === 0) {
        context.shadowColor = "rgba(73, 245, 162, 0.7)";
        context.shadowBlur = 16;
        context.fillStyle = "#5cffb0";
      } else {
        const lightness = Math.max(38, 61 - index * 1.4);
        context.fillStyle = `hsl(156 74% ${lightness}%)`;
      }

      roundedRect(context, x, y, size, size, index === 0 ? 6 : 5);
      context.fill();

      if (index === 0) {
        drawEyes(segment);
      }

      context.restore();
    });
  }

  function drawEyes(head) {
    const centerX = head.x * CELL_SIZE + CELL_SIZE / 2;
    const centerY = head.y * CELL_SIZE + CELL_SIZE / 2;
    const eyeOffsetX = direction.y === 0 ? 3 : 4;
    const eyeOffsetY = direction.x === 0 ? 3 : 4;

    context.fillStyle = "#082018";

    if (direction.x !== 0) {
      const eyeX = centerX + direction.x * 3;
      context.beginPath();
      context.arc(eyeX, centerY - eyeOffsetY, 1.55, 0, Math.PI * 2);
      context.arc(eyeX, centerY + eyeOffsetY, 1.55, 0, Math.PI * 2);
      context.fill();
    } else {
      const eyeY = centerY + direction.y * 3;
      context.beginPath();
      context.arc(centerX - eyeOffsetX, eyeY, 1.55, 0, Math.PI * 2);
      context.arc(centerX + eyeOffsetX, eyeY, 1.55, 0, Math.PI * 2);
      context.fill();
    }
  }

  function drawFood(position) {
    const centerX = position.x * CELL_SIZE + CELL_SIZE / 2;
    const centerY = position.y * CELL_SIZE + CELL_SIZE / 2;
    const pulse = 1 + Math.sin(performance.now() / 170) * 0.06;

    context.save();
    context.shadowColor = "rgba(255, 92, 122, 0.85)";
    context.shadowBlur = 18;

    context.fillStyle = "#ff6b85";
    context.beginPath();
    context.arc(centerX, centerY, 6.2 * pulse, 0, Math.PI * 2);
    context.fill();

    context.shadowBlur = 0;
    context.fillStyle = "rgba(255, 255, 255, 0.78)";
    context.beginPath();
    context.arc(centerX - 2, centerY - 2.2, 1.7, 0, Math.PI * 2);
    context.fill();

    context.strokeStyle = "#91f5b6";
    context.lineWidth = 2;
    context.lineCap = "round";
    context.beginPath();
    context.moveTo(centerX + 1, centerY - 6);
    context.quadraticCurveTo(centerX + 2, centerY - 10, centerX + 6, centerY - 10);
    context.stroke();
    context.restore();
  }

  function drawBombs() {
    bombs.forEach((bomb) => {
      drawBomb(bomb);
    });
  }

  function drawBomb(position) {
    const centerX = position.x * CELL_SIZE + CELL_SIZE / 2;
    const centerY = position.y * CELL_SIZE + CELL_SIZE / 2;
    const pulse =
      1 +
      Math.sin(performance.now() / 125 + position.x * 0.35 + position.y) *
        0.08;

    context.save();

    context.fillStyle = "rgba(255, 92, 122, 0.08)";
    context.beginPath();
    context.arc(centerX, centerY, 9 * pulse, 0, Math.PI * 2);
    context.fill();

    context.shadowColor = "rgba(255, 64, 96, 0.9)";
    context.shadowBlur = 14;
    context.fillStyle = "#190b12";
    context.strokeStyle = "#ff5c7a";
    context.lineWidth = 1.4;
    context.beginPath();
    context.arc(centerX, centerY + 0.8, 6.3 * pulse, 0, Math.PI * 2);
    context.fill();
    context.stroke();

    context.shadowBlur = 0;
    context.strokeStyle = "#ff7f95";
    context.lineWidth = 1.5;
    context.lineCap = "round";

    for (let index = 0; index < 8; index += 1) {
      const angle = (Math.PI * 2 * index) / 8;
      context.beginPath();
      context.moveTo(
        centerX + Math.cos(angle) * 6.1,
        centerY + Math.sin(angle) * 6.1 + 0.8,
      );
      context.lineTo(
        centerX + Math.cos(angle) * 7.2,
        centerY + Math.sin(angle) * 7.2 + 0.8,
      );
      context.stroke();
    }

    context.fillStyle = "rgba(255, 184, 196, 0.86)";
    context.beginPath();
    context.arc(centerX - 1.8, centerY - 1.8, 1.45, 0, Math.PI * 2);
    context.fill();

    context.strokeStyle = "#ffd166";
    context.lineWidth = 1.6;
    context.beginPath();
    context.moveTo(centerX + 2.5, centerY - 6);
    context.quadraticCurveTo(centerX + 3, centerY - 9, centerX + 5.5, centerY - 9);
    context.stroke();

    context.restore();
  }

  function drawOverlay(title, subtitle) {
    context.save();
    context.fillStyle = "rgba(4, 9, 15, 0.72)";
    context.fillRect(0, 0, BOARD_SIZE, BOARD_SIZE);

    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillStyle = "#f4f7fb";
    context.font =
      '800 44px "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif';
    context.fillText(title, BOARD_SIZE / 2, BOARD_SIZE / 2 - 20);

    context.fillStyle = "#9eacc0";
    context.font =
      '500 19px "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif';
    context.fillText(subtitle, BOARD_SIZE / 2, BOARD_SIZE / 2 + 34);
    context.restore();
  }

  function roundedRect(ctx, x, y, width, height, radius) {
    const safeRadius = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + safeRadius, y);
    ctx.arcTo(x + width, y, x + width, y + height, safeRadius);
    ctx.arcTo(x + width, y + height, x, y + height, safeRadius);
    ctx.arcTo(x, y + height, x, y, safeRadius);
    ctx.arcTo(x, y, x + width, y, safeRadius);
    ctx.closePath();
  }

  function togglePause() {
    if (gameOver) {
      return;
    }

    paused = !paused;
    accumulator = 0;
    previousTime = 0;
    updateHud();
  }

  function gameLoop(timestamp) {
    if (!previousTime) {
      previousTime = timestamp;
    }

    const elapsed = Math.min(timestamp - previousTime, 100);
    previousTime = timestamp;

    if (!paused && !gameOver) {
      accumulator += elapsed;
      bombAccumulator += elapsed;

      if (bombAccumulator >= BOMB_RELOCATE_INTERVAL) {
        bombAccumulator %= BOMB_RELOCATE_INTERVAL;
        relocateBombs();
      }

      while (accumulator >= MOVE_INTERVAL) {
        update();
        accumulator -= MOVE_INTERVAL;

        if (gameOver) {
          break;
        }
      }
    }

    draw();
    window.requestAnimationFrame(gameLoop);
  }

  window.addEventListener("keydown", (event) => {
    if (DIRECTIONS[event.key]) {
      event.preventDefault();
      setDirection(DIRECTIONS[event.key]);
      return;
    }

    if (event.code === "Space") {
      event.preventDefault();
      togglePause();
      return;
    }

    if (event.key.toLowerCase() === "r" || event.key === "Enter") {
      event.preventDefault();
      resetGame();
    }
  });

  restartButton.addEventListener("click", resetGame);

  resetGame();
  window.requestAnimationFrame(gameLoop);
})();
