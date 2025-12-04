// script.js — cleaned & optimized (Option B: separate explosion canvas)
// IIFE to avoid leaking globals
(() => {
  // ------------------------------------------------------
  // ELEMENTS
  // ------------------------------------------------------
  const circle = document.getElementById("circle");
  const scoreEl = document.getElementById("score");
  const timerEl = document.getElementById("timer");
  const startScreen = document.getElementById("start");
  const startButton = document.getElementById("startButton");
  const restartScreen = document.getElementById("restart");
  const diffButtons = document.querySelectorAll(".diff-btn");

  // matrix canvas MUST exist in your HTML
  const matrixCanvas = document.getElementById("matrixCanvas");
  if (!matrixCanvas) {
    console.error("matrixCanvas missing from DOM!");
    return;
  }
  const matrixCtx = matrixCanvas.getContext("2d");

  // create explosion canvas if missing (Option B)
  let explosionCanvas = document.getElementById("explosionCanvas");
  if (!explosionCanvas) {
    explosionCanvas = document.createElement("canvas");
    explosionCanvas.id = "explosionCanvas";
    Object.assign(explosionCanvas.style, {
      position: "fixed",
      left: "0",
      top: "0",
      width: "100%",
      height: "100%",
      pointerEvents: "none",
      zIndex: 9999
    });
    document.body.appendChild(explosionCanvas);
  }
  const explCtx = explosionCanvas.getContext("2d");

  // ------------------------------------------------------
  // DEVICE DETECTION & PERFORMANCE TUNING
  // ------------------------------------------------------
  const isMobile = /Mobi|Android|iPhone|iPad|iPod|Windows Phone/i.test(navigator.userAgent);
  // reduce visual intensity on very old devices or very small screens (simple heuristic)
  const perfTier = isMobile ? "mobile" : "desktop";

  // ------------------------------------------------------
  // DIFFICULTY SETTINGS
  // ------------------------------------------------------
  let currentDifficulty = "normal";
  const DIFFICULTY = {
    easy:   { delay: 750, size: 90, chaos: false },
    normal: { delay: 650, size: 60, chaos: false },
    hard:   { delay: 550, size: 40, chaos: false },
    chaos:  { delay: 450, size: 30, chaos: true }
  };

  let MOVE_DELAY = DIFFICULTY.normal.delay;
  let chaosActive = false;
  let matrixColor = "rgba(0,255,0,0.4)";

  // ------------------------------------------------------
  // GAME STATE
  // ------------------------------------------------------
  let score = 0;
  let timeLeft = 30;
  let gameActive = false;

  let combo = 0;
  let maxCombo = 0;
  let misses = 0;

  let moveInterval = null;
  let timerInterval = null;

  const INPUT_DEBOUNCE_MS = 80;
  let lastInputTime = 0;

  // ------------------------------------------------------
  // MATRIX CANVAS SETUP (dpi aware)
  // ------------------------------------------------------
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@$%&*";
  let fontSize = isMobile ? 14 : 18;
  let dpr = Math.max(1, window.devicePixelRatio || 1);

  function setupMatrixCanvas() {
    dpr = Math.max(1, window.devicePixelRatio || 1);
    const w = Math.floor(window.innerWidth);
    const h = Math.floor(window.innerHeight);
    matrixCanvas.style.width = `${w}px`;
    matrixCanvas.style.height = `${h}px`;
    matrixCanvas.width = Math.floor(w * dpr);
    matrixCanvas.height = Math.floor(h * dpr);
    matrixCtx.setTransform(dpr, 0, 0, dpr, 0, 0); // scale drawing to CSS pixels
    fontSize = isMobile ? 14 : 18;
  }

  // columns and drops depend on canvas width and fontSize
  let width = window.innerWidth;
  let height = window.innerHeight;
  let columns = Math.max(1, Math.floor(width / fontSize));
  let drops = Array.from({ length: columns }, () => Math.random() * height);

  function rebuildColumns() {
    width = window.innerWidth;
    height = window.innerHeight;
    columns = Math.max(1, Math.floor(width / fontSize));
    if (drops.length < columns) {
      for (let i = drops.length; i < columns; i++) drops[i] = Math.random() * height;
    } else {
      drops.length = columns;
    }
  }

  // ------------------------------------------------------
  // EXPLOSION CANVAS SETUP (dpi aware)
  // ------------------------------------------------------
  function setupExplosionCanvas() {
    const w = Math.floor(window.innerWidth);
    const h = Math.floor(window.innerHeight);
    explosionCanvas.style.width = `${w}px`;
    explosionCanvas.style.height = `${h}px`;
    explosionCanvas.width = Math.floor(w * dpr);
    explosionCanvas.height = Math.floor(h * dpr);
    explCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // ------------------------------------------------------
  // UI UPDATES
  // ------------------------------------------------------
  const updateScore = () => { if (scoreEl) scoreEl.textContent = `Score: ${score}`; };
  const updateTimer = () => { if (timerEl) timerEl.textContent = timeLeft; };

  // ------------------------------------------------------
  // SCREEN SHAKE (CSS class assumed)
  // ------------------------------------------------------
  function screenShake() {
    // small optimization: use requestAnimationFrame to avoid layout thrash
    document.body.classList.add("shake");
    setTimeout(() => document.body.classList.remove("shake"), 150);
  }

  // ------------------------------------------------------
  // FLOATING TEXT (small number of DOM nodes only)
  // ------------------------------------------------------
  function showFloatingText(text, x, y, cssClass = "") {
    const t = document.createElement("div");
    t.className = `floating-text ${cssClass}`.trim();
    t.textContent = text;
    t.style.left = `${x}px`;
    t.style.top = `${y}px`;
    t.style.position = "fixed";
    t.style.pointerEvents = "none";
    document.body.appendChild(t);

    // animate with transform / opacity (GPU friendly)
    requestAnimationFrame(() => {
      t.style.transform = "translateY(-35px)";
      t.style.opacity = 0;
    });

    setTimeout(() => t.remove(), 850);
  }

  function showComboText() {
    if (combo < 2) return;
    const t = document.createElement("div");
    t.className = "floating-text floating-combo";
    t.textContent = `COMBO x${combo}`;
    t.style.position = "fixed";
    t.style.left = "50%";
    t.style.top = "8vh";
    t.style.transform = "translateX(-50%)";
    t.style.pointerEvents = "none";
    document.body.appendChild(t);

    requestAnimationFrame(() => {
      t.style.transform = "translate(-50%, -40px)";
      t.style.opacity = 0;
    });
    setTimeout(() => t.remove(), 850);
  }

  // ------------------------------------------------------
  // CIRCLE MOVEMENT
  // ------------------------------------------------------
  function moveCircleOnce() {
    if (!circle) return;
    const size = circle.offsetWidth;
    const pad = 10;
    let x = Math.random() * (window.innerWidth - size - pad * 2) + pad;
    let y = Math.random() * (window.innerHeight - size - pad * 2) + pad;
    x = Math.min(Math.max(x, pad), window.innerWidth - size - pad);
    y = Math.min(Math.max(y, pad), window.innerHeight - size - pad);
    circle.style.left = `${x}px`;
    circle.style.top = `${y}px`;
  }

  function startMoving() {
    stopMoving();
    const reactionMultiplier = isMobile ? 1 : 1.5;
    const adjustedDelay = MOVE_DELAY * reactionMultiplier;
    // Use setInterval for simple periodic movement (light)
    moveInterval = setInterval(() => {
      if (gameActive) moveCircleOnce();
    }, adjustedDelay);
    // immediate move
    moveCircleOnce();
  }

  function stopMoving() {
    if (moveInterval) {
      clearInterval(moveInterval);
      moveInterval = null;
    }
  }

  // ------------------------------------------------------
  // TIMER
  // ------------------------------------------------------
  function startTimer() {
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
      if (!gameActive) return;
      timeLeft--;
      updateTimer();
      if (timeLeft <= 0) endGame();
    }, 1000);
  }

  // ------------------------------------------------------
  // OPTIMIZED PARTICLE (EXPLOSION) SYSTEM (canvas-based)
  // ------------------------------------------------------
  const particles = [];
  const explosionChars = "01∆Ω¥$%#@&*/≠≡πψ§{}[]<>+-;";
  function spawnExplosion(cx, cy) {
    const baseCount = 60;
    // fewer particles on mobile to save CPU
    const count = perfTier === "mobile" ? Math.round(baseCount * 0.5) : baseCount;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 60 + Math.random() * 140;
      const speed = (dist / 24) * (0.6 + Math.random() * 0.8);
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed;
      const life = 600 + Math.random() * 250; // ms
      const size = (isMobile ? 12 : 16) + Math.random() * (isMobile ? 6 : 8);
      const char = explosionChars.charAt(Math.floor(Math.random() * explosionChars.length));
      particles.push({
        x: cx,
        y: cy,
        vx,
        vy,
        life,
        age: 0,
        size,
        char,
        rotation: Math.random() * Math.PI * 2,
        angularVel: (Math.random() - 0.5) * 0.08
      });
    }
  }

  let lastExplTimestamp = 0;
  function updateAndDrawExplosions(now) {
    // clear explosion canvas with slight fade for trails effect or full clear
    explCtx.clearRect(0, 0, explosionCanvas.width / dpr, explosionCanvas.height / dpr);

    // draw each particle
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      const delta = Math.min(40, now - (p._last || now));
      p._last = now;

      p.age += delta;
      if (p.age >= p.life) {
        particles.splice(i, 1);
        continue;
      }

      const t = p.age / p.life;
      // physics
      p.vx *= 0.995; // slight drag
      p.vy += 0.035; // gravity
      p.x += p.vx * (delta / 16);
      p.y += p.vy * (delta / 16);
      p.rotation += p.angularVel;

      // visual
      const alpha = Math.max(0, 1 - t);
      explCtx.save();
      explCtx.globalAlpha = alpha;
      explCtx.font = `${p.size}px monospace`;
      // simple shadow/glow
      explCtx.shadowBlur = Math.min(12, p.size / 2);
      explCtx.shadowColor = "rgba(0,255,255,0.4)";
      // translate + rotate so chars can spin
      explCtx.translate(p.x, p.y);
      explCtx.rotate(p.rotation);
      explCtx.fillStyle = "rgba(0, 255, 255, 1)";
      explCtx.fillText(p.char, -p.size / 2, 0);
      explCtx.restore();
    }
  }

  // explosion animation loop
  let explRAF = null;
  function explosionLoop(ts) {
    updateAndDrawExplosions(ts || performance.now());
    explRAF = requestAnimationFrame(explosionLoop);
  }

  // ------------------------------------------------------
  // HIT HANDLING
  // ------------------------------------------------------
  function explodeCircle() {
    stopMoving();
    const rect = circle.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;

    // spawn canvas explosion
    spawnExplosion(cx, cy);

    // quick visual hide/pulse on circle
    circle.style.opacity = 0;
    setTimeout(() => {
      circle.style.opacity = 1;
      if (gameActive) startMoving();
    }, 140);

    screenShake();
  }

  function handleHit(e) {
    const now = performance.now();
    if (now - lastInputTime < INPUT_DEBOUNCE_MS) return;
    lastInputTime = now;

    if (!gameActive) return;

    score++;
    combo++;
    if (combo > maxCombo) maxCombo = combo;
    updateScore();
    showComboText();

    // coordinates fallback (pointer events are expected)
    const x = (typeof e.clientX === "number") ? e.clientX : window.innerWidth / 2;
    const y = (typeof e.clientY === "number") ? e.clientY : window.innerHeight / 2;

    explodeCircle();
    showFloatingText("SIGNAL_DESTROYED", x, y, "floating-hit");
  }

  // ------------------------------------------------------
  // INPUTS
  // ------------------------------------------------------
  if (circle) {
    circle.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      handleHit(e);
    }, { passive: false });
  }

  document.addEventListener("pointerup", (e) => {
    if (!gameActive || e.target === circle) return;

    const rect = circle.getBoundingClientRect();
    const dx = e.clientX - (rect.left + rect.width / 2);
    const dy = e.clientY - (rect.top + rect.height / 2);
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > rect.width * 0.6) {
      if (combo > maxCombo) maxCombo = combo;
      combo = 0;
      misses++;
      showFloatingText("TRACE_LOST", e.clientX, e.clientY, "floating-miss");
    }
  });

  // ------------------------------------------------------
  // DIFFICULTY / GAME CONTROL
  // ------------------------------------------------------
  function applyDifficulty() {
    const d = DIFFICULTY[currentDifficulty] || DIFFICULTY.normal;
    MOVE_DELAY = d.delay;
    chaosActive = !!d.chaos;
    if (circle) {
      circle.style.width = `${d.size}px`;
      circle.style.height = `${d.size}px`;
    }
    matrixColor = chaosActive ? "rgba(255,0,0,0.4)" : "rgba(0,255,0,0.4)";
  }

  function startGame() {
    score = combo = maxCombo = misses = 0;
    timeLeft = 30;
    gameActive = true;

    applyDifficulty();
    updateScore();
    updateTimer();

    if (startScreen) startScreen.style.display = "none";
    if (restartScreen) restartScreen.style.display = "none";
    if (circle) circle.style.display = "block";

    // start loops
    startMoving();
    startTimer();

    // ensure explosion loop running
    if (!explRAF) explRAF = requestAnimationFrame(explosionLoop);
  }

  function endGame() {
    gameActive = false;
    stopMoving();
    if (circle) circle.style.display = "none";

    // stop particles? we let current particles fade out
    // Build restart screen content
    if (!restartScreen) return;

    restartScreen.innerHTML = "";

    // Title
    const title = document.createElement("div");
    title.textContent = "GAME OVER!";
    title.style.fontSize = "clamp(24px,6vmin,48px)";
    title.style.fontWeight = "bold";
    title.style.marginBottom = "2vmin";
    title.style.color = "#f00";
    title.style.textShadow = "0 0 15px #f00, 0 0 30px #f00";
    restartScreen.appendChild(title);

    // Stats
    const stats = document.createElement("div");
    stats.innerHTML = `Score: ${score}<br>Misses: ${misses}<br>Max Combo: ${maxCombo}`;
    stats.style.fontSize = "clamp(14px,4vmin,22px)";
    stats.style.marginBottom = "2vmin";
    stats.style.color = "#0ff";
    stats.style.textShadow = "0 0 7.5px #0ff, 0 0 15px #0ff";
    stats.style.textAlign = "center";
    restartScreen.appendChild(stats);

    // Buttons
    const btnContainer = document.createElement("div");
    btnContainer.style.display = "flex";
    btnContainer.style.gap = "4vmin";
    btnContainer.style.justifyContent = "center";
    btnContainer.style.marginTop = "1.5vmin";

    const restartBtn = document.createElement("div");
    restartBtn.textContent = "REPLAY";
    restartBtn.className = "restart-btn";
    restartBtn.addEventListener("pointerdown", startGame);

    const backBtn = document.createElement("div");
    backBtn.textContent = "RETURN";
    backBtn.className = "restart-btn";
    backBtn.addEventListener("pointerdown", () => {
      restartScreen.style.display = "none";
      if (startScreen) startScreen.style.display = "flex";
    });

    btnContainer.appendChild(restartBtn);
    btnContainer.appendChild(backBtn);
    restartScreen.appendChild(btnContainer);

    displayHighScores(restartScreen);

    const saveScoreBtn = document.createElement("div");
    saveScoreBtn.textContent = "SAVE SCORE";
    saveScoreBtn.className = "restart-btn";
    saveScoreBtn.style.margin = "2vmin 0";
    restartScreen.appendChild(saveScoreBtn);

    saveScoreBtn.addEventListener("pointerdown", () => {
      saveScoreBtn.remove();
      showHighScoreInput();
    });

    restartScreen.style.display = "flex";
    restartScreen.style.flexDirection = "column";
    restartScreen.style.alignItems = "center";
  }

  // ------------------------------------------------------
  // HIGHSCORE STORAGE & DISPLAY
  // ------------------------------------------------------
  function saveHighScore(initials, scoreValue) {
    const scores = JSON.parse(localStorage.getItem("highScores") || "[]");
    const entry = { initials, score: scoreValue, difficulty: currentDifficulty.toUpperCase() };
    scores.push(entry);
    scores.sort((a, b) => b.score - a.score);
    const trimmed = scores.slice(0, 10);
    localStorage.setItem("highScores", JSON.stringify(trimmed));
  }

  function displayHighScores(container = restartScreen) {
    const existing = container.querySelector(".high-score-list");
    if (existing) existing.remove();

    const scores = JSON.parse(localStorage.getItem("highScores") || "[]");

    const hsContainer = document.createElement("div");
    hsContainer.className = "high-score-list";
    hsContainer.style.marginTop = "7vmin";
    hsContainer.style.color = "#0ff";
    hsContainer.style.fontSize = "clamp(14px,3vmin,20px)";
    hsContainer.style.textAlign = "center";

    hsContainer.innerHTML = "<strong>HIGH SCORES</strong><br>";

    if (scores.length === 0) {
      hsContainer.innerHTML += "No scores yet.<br>";
    } else {
      scores.forEach((s, i) => {
        const diff = s.difficulty ? s.difficulty : "UNKNOWN";
        hsContainer.innerHTML += `${i + 1}. ${s.initials} — ${s.score} / ${diff}<br>`;
      });
    }

    container.appendChild(hsContainer);
  }

  // ------------------------------------------------------
  // HIGH SCORE INPUT UI
  // ------------------------------------------------------
  function showHighScoreInput() {
    if (!restartScreen) return;
    const scoreInputContainer = document.createElement("div");
    scoreInputContainer.style.marginTop = "2vmin";
    scoreInputContainer.style.textAlign = "center";
    scoreInputContainer.style.width = "260px";
    scoreInputContainer.style.maxWidth = "80vw";
    scoreInputContainer.style.margin = "0 auto";

    const label = document.createElement("div");
    label.textContent = "Enter your initials:";
    label.style.color = "#0ff";
    label.style.fontSize = "clamp(14px,3vmin,20px)";
    label.style.marginBottom = "1vmin";
    label.style.marginTop = "1vmin";

    const input = document.createElement("input");
    input.type = "text";
    input.maxLength = 3;
    input.style.textTransform = "uppercase";
    input.style.fontSize = "clamp(16px,4vmin,28px)";
    input.style.padding = "0.5em";
    input.style.width = "6ch";
    input.style.textAlign = "center";
    input.style.border = "2px solid #0ff";
    input.style.borderRadius = "8px";
    input.style.background = "rgba(0,0,0,0.4)";
    input.style.color = "#0ff";

    const warning = document.createElement("div");
    warning.style.color = "#f00";
    warning.style.marginTop = "6vmin";
    warning.style.fontSize = "clamp(14px,3vmin,20px)";
    warning.style.fontWeight = "bold";
    warning.style.minHeight = "1.5em";
    warning.style.opacity = 0;
    warning.style.transition = "opacity 0.28s ease";
    warning.style.whiteSpace = "normal";
    warning.style.width = "100%";
    warning.style.wordWrap = "break-word";

    let warningTimer = null;
    function clearWarning() {
      if (warningTimer) {
        clearTimeout(warningTimer);
        warningTimer = null;
      }
      warning.textContent = "";
      warning.style.opacity = 0;
    }
    function showWarning(text, autoHide = true) {
      clearWarning();
      warning.textContent = text;
      requestAnimationFrame(() => { warning.style.opacity = 1; });
      if (autoHide) {
        warningTimer = setTimeout(() => {
          warning.style.opacity = 0;
          warningTimer = null;
        }, 2000);
      }
    }

    input.addEventListener("input", () => {
      input.value = input.value.toUpperCase().replace(/[^A-Z]/g, "");
      clearWarning();
    });

    const saveBtn = document.createElement("div");
    saveBtn.textContent = "SAVE SCORE";
    saveBtn.className = "restart-btn";
    saveBtn.style.marginTop = "1.5vmin";

    saveBtn.addEventListener("pointerdown", () => {
      const raw = input.value;
      if (raw.length === 0) {
        showWarning("Please enter at least one letter!");
        input.focus();
        return;
      }

      const padded = raw.padEnd(3, "_");
      const scores = JSON.parse(localStorage.getItem("highScores") || "[]");

      if (scores.some(s => s.initials === padded)) {
        showWarning("This one is taken, please choose another!");
        input.focus();
        return;
      }

      saveHighScore(padded, score);
      scoreInputContainer.remove();
      displayHighScores(restartScreen);
    });

    scoreInputContainer.appendChild(label);
    scoreInputContainer.appendChild(input);
    scoreInputContainer.appendChild(saveBtn);
    scoreInputContainer.appendChild(warning);

    restartScreen.appendChild(scoreInputContainer);
    clearWarning();
    input.focus();
  }

  // ------------------------------------------------------
  // BUTTONS / DIFFICULTY SELECT
  // ------------------------------------------------------
  if (startButton) {
    startButton.addEventListener("pointerdown", (e) => { e.preventDefault(); startGame(); });
  }

  diffButtons.forEach(btn => {
    btn.addEventListener("pointerdown", () => {
      diffButtons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      currentDifficulty = btn.dataset.mode || "normal";
      applyDifficulty();
    });
  });

  // ------------------------------------------------------
  // MATRIX RENDER LOOP (optimized)
  // ------------------------------------------------------
  let matrixRAF = null;
  function drawMatrix() {
    // fade background to create "trails"
    matrixCtx.fillStyle = chaosActive ? "rgba(0,0,0,0.12)" : "rgba(0,0,0,0.05)";
    matrixCtx.fillRect(0, 0, width, height);

    matrixCtx.fillStyle = matrixColor;
    matrixCtx.font = `${fontSize}px monospace`;

    for (let i = 0; i < drops.length; i++) {
      const text = letters.charAt(Math.floor(Math.random() * letters.length));
      matrixCtx.fillText(text, i * fontSize, drops[i]);

      // move drop; chaos changes speed & randomness
      drops[i] += chaosActive ? fontSize * (0.8 + Math.random() * 0.5) : fontSize;
      if (drops[i] > height && Math.random() > (chaosActive ? 0.85 : 0.975)) {
        drops[i] = 0;
      }

      if (chaosActive) {
        const jitter = Math.random() * fontSize - fontSize / 2;
        matrixCtx.fillText(text, i * fontSize + jitter, drops[i]);
      }
    }

    matrixRAF = requestAnimationFrame(drawMatrix);
  }

  // ------------------------------------------------------
  // RESIZE HANDLING (debounced)
  // ------------------------------------------------------
  let resizeTimer = null;
  function onResize() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      setupMatrixCanvas();
      setupExplosionCanvas();
      rebuildColumns();
      moveCircleOnce();
    }, 120);
  }
  window.addEventListener("resize", onResize);

  // ------------------------------------------------------
  // INIT / START LOOPS
  // ------------------------------------------------------
  function init() {
    setupMatrixCanvas();
    setupExplosionCanvas();
    rebuildColumns();

    // start matrix loop
    if (!matrixRAF) matrixRAF = requestAnimationFrame(drawMatrix);
    // start explosion loop but it will render even if no particles (cheap)
    if (!explRAF) explRAF = requestAnimationFrame(explosionLoop);

    updateScore();
    updateTimer();
  }

  // ------------------------------------------------------
  // CLEANUP (for hot reload or dev)
  // ------------------------------------------------------
  function cleanup() {
    if (matrixRAF) cancelAnimationFrame(matrixRAF);
    if (explRAF) cancelAnimationFrame(explRAF);
    if (moveInterval) clearInterval(moveInterval);
    if (timerInterval) clearInterval(timerInterval);
    resizeTimer && clearTimeout(resizeTimer);
  }

  // expose a minimal API for dev console if helpful
  window._game = {
    startGame,
    endGame,
    cleanup
  };

  // auto init
  init();

})();
