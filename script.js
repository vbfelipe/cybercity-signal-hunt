(() => {
  // --------- DOM & config ----------
  const $ = sel => document.querySelector(sel);
  const circle = $('#circle');
  const scoreEl = $('#score');
  const timerEl = $('#timer');
  const startScreen = $('#start');
  const startButton = $('#startButton');
  const restartScreen = $('#restart');
  const diffButtons = document.querySelectorAll('.diff-btn');
  const matrixCanvas = $('#matrixCanvas');
  let gamePaused = false;
  let pausedOverlay = null;

  if (!matrixCanvas) {
    console.error('matrixCanvas missing');
    return;
  }

  let explosionCanvas = $('#explosionCanvas');
  if (!explosionCanvas) {
    explosionCanvas = document.createElement('canvas');
    explosionCanvas.id = 'explosionCanvas';
    Object.assign(explosionCanvas.style, {
      position: 'fixed',
      inset: '0',
      pointerEvents: 'none',
      zIndex: 2000
    });
    document.body.appendChild(explosionCanvas);
  }

  const matrixCtx = matrixCanvas.getContext('2d');
  const explCtx = explosionCanvas.getContext('2d');

  // --------- state ----------
  const isMobile = /Mobi|Android|iPhone|iPad|iPod|Windows Phone/i.test(navigator.userAgent);
  const dpr = () => Math.max(1, window.devicePixelRatio || 1);

  const DIFFICULTY = {
    easy:   { delay: 750, size: 90, chaos: false },
    normal: { delay: 650, size: 60, chaos: false },
    hard:   { delay: 550, size: 40, chaos: false },
    chaos:  { delay: 450, size: 30, chaos: true }
  };
  let currentDifficulty = 'normal';

  let score = 0;
  let timeLeft = 30;
  let gameActive = false;
  let combo = 0;
  let maxCombo = 0;
  let misses = 0;

  const INPUT_DEBOUNCE_MS = 80;
  let lastInputTime = 0;

  let moveTimer = null;
  let timerInterval = null;

  // --------- canvas layout & matrix data ----------
  let width = 0, height = 0;
  let fontSize = isMobile ? 14 : 18;
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@$%&*';
  let columns = 0;
  let drops = [];

  function resizeCanvases() {
    const p = dpr();
    width = Math.floor(window.innerWidth);
    height = Math.floor(window.innerHeight);

    matrixCanvas.style.width = `${width}px`;
    matrixCanvas.style.height = `${height}px`;
    matrixCanvas.width = Math.floor(width * p);
    matrixCanvas.height = Math.floor(height * p);
    matrixCtx.setTransform(p, 0, 0, p, 0, 0);

    explosionCanvas.style.width = `${width}px`;
    explosionCanvas.style.height = `${height}px`;
    explosionCanvas.width = Math.floor(width * p);
    explosionCanvas.height = Math.floor(height * p);
    explCtx.setTransform(p, 0, 0, p, 0, 0);

    fontSize = isMobile ? 14 : 18;
    columns = Math.max(1, Math.floor(width / fontSize));
    if (drops.length < columns) {
      for (let i = drops.length; i < columns; i++) drops[i] = Math.random() * height;
    } else {
      drops.length = columns;
    }

    moveCircleOnce();
  }
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resizeCanvases, 120);
  });
  let resizeTimer = null;

  // --------- matrix renderer ----------
  let matrixRAF = null;
  let matrixColor = 'rgba(0,255,0,0.4)';
  let chaosActive = false;

  function drawMatrix() {
    matrixCtx.fillStyle = chaosActive ? 'rgba(0,0,0,0.12)' : 'rgba(0,0,0,0.05)';
    matrixCtx.fillRect(0, 0, width, height);

    matrixCtx.fillStyle = matrixColor;
    matrixCtx.font = `${fontSize}px monospace`;
    matrixCtx.textBaseline = 'top';

    for (let i = 0; i < columns; i++) {
      const text = letters.charAt(Math.floor(Math.random() * letters.length));
      const x = i * fontSize;
      const y = Math.floor(drops[i]);

      matrixCtx.fillText(text, x, y);

      drops[i] += chaosActive ? fontSize * (0.8 + Math.random() * 0.5) : fontSize;
      if (drops[i] > height && Math.random() > (chaosActive ? 0.85 : 0.975)) {
        drops[i] = 0;
      }

      if (chaosActive) {
        const jitter = Math.random() * fontSize - fontSize / 2;
        matrixCtx.fillText(text, x + jitter, y);
      }
    }

    matrixRAF = requestAnimationFrame(drawMatrix);
  }

  // --------- explosion particles (pool) ----------
  const particles = [];
  const pool = [];
  const explosionChars = '01∆Ω¥$%#@&*/≠≡πψ§{}[]<>+-;';
  let explRAF = null;

  function spawnExplosion(cx, cy) {
    const baseCount = 60;
    const count = isMobile ? Math.round(baseCount * 0.5) : baseCount;

    for (let i = 0; i < count; i++) {
      let p = pool.pop();
      if (!p) p = {};
      const angle = Math.random() * Math.PI * 2;
      const dist = 60 + Math.random() * 140;
      const speed = (dist / 24) * (0.6 + Math.random() * 0.8);
      p.x = cx;
      p.y = cy;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed;
      p.age = 0;
      p.life = 600 + Math.random() * 250;
      p.size = (isMobile ? 12 : 16) + Math.random() * (isMobile ? 6 : 8);
      p.char = explosionChars.charAt((Math.random() * explosionChars.length) | 0);
      p.rotation = Math.random() * Math.PI * 2;
      p.angular = (Math.random() - 0.5) * 0.08;
      particles.push(p);
    }

    if (!explRAF) explRAF = requestAnimationFrame(explosionLoop);
  }

  function explosionLoop(ts) {
    explCtx.clearRect(0, 0, width, height);

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      const dt = Math.min(40, (p._last ? ts - p._last : 16));
      p._last = ts;

      p.age += dt;
      if (p.age >= p.life) {
        pool.push(...particles.splice(i, 1));
        continue;
      }

      const t = p.age / p.life;
      p.vx *= 0.995;
      p.vy += 0.035;
      p.x += p.vx * (dt / 16);
      p.y += p.vy * (dt / 16);
      p.rotation += p.angular;

      explCtx.save();
      explCtx.globalAlpha = Math.max(0, 1 - t);
      explCtx.font = `${p.size}px monospace`;
      explCtx.textAlign = 'center';
      explCtx.textBaseline = 'middle';
      explCtx.shadowBlur = Math.min(12, p.size / 2);
      explCtx.shadowColor = 'rgba(0,255,255,0.35)';
      explCtx.translate(p.x, p.y);
      explCtx.rotate(p.rotation);
      explCtx.fillStyle = 'rgba(0,255,255,1)';
      explCtx.fillText(p.char, 0, 0);
      explCtx.restore();
    }

    if (particles.length > 0) explRAF = requestAnimationFrame(explosionLoop);
    else {
      explRAF = null;
    }
  }

  // --------- floating text ----------
  function showFloatingText(text, x, y, cls = '') {
    const el = document.createElement('div');
    el.className = `floating-text ${cls}`.trim();
    el.textContent = text;
    Object.assign(el.style, {
      position: 'fixed',
      left: `${x}px`,
      top: `${y}px`,
      pointerEvents: 'none',
      transformOrigin: 'center'
    });
    document.body.appendChild(el);
    requestAnimationFrame(() => {
      el.style.transform = 'translateY(-35px)';
      el.style.opacity = '0';
    });
    setTimeout(() => el.remove(), 850);
  }

  function showComboText() {
    if (combo < 2) return;
    const el = document.createElement('div');
    el.className = 'floating-text floating-combo';
    el.textContent = `COMBO x${combo}`;
    Object.assign(el.style, {
      position: 'fixed',
      left: '50%',
      top: '8vh',
      transform: 'translateX(-50%)',
      pointerEvents: 'none'
    });
    document.body.appendChild(el);
    requestAnimationFrame(() => {
      el.style.transform = 'translate(-50%, -40px)';
      el.style.opacity = '0';
    });
    setTimeout(() => el.remove(), 850);
  }

  // --------- target movement ----------
 function moveCircleOnce() {
  if (!circle) return;
  const sizeW = circle.offsetWidth;
  const sizeH = circle.offsetHeight;
  const pad = 10;
  let x = Math.random() * (window.innerWidth - sizeW - pad * 2) + pad;
  let y = Math.random() * (window.innerHeight - sizeH - pad * 2) + pad;
  x = Math.min(Math.max(x, pad), window.innerWidth - sizeW - pad);
  y = Math.min(Math.max(y, pad), window.innerHeight - sizeH - pad);
  // set left/top so CSS animations that use transform won't conflict
  circle.style.left = `${x}px`;
  circle.style.top = `${y}px`;
}

function startMoving() {
  stopMoving();
  const reaction = isMobile ? 1 : 1.5;
  const delay = DIFFICULTY[currentDifficulty].delay * reaction;
  moveCircleOnce();
  moveTimer = setInterval(() => { if (gameActive) moveCircleOnce(); }, delay);
}


  function stopMoving() {
    if (moveTimer) { clearInterval(moveTimer); moveTimer = null; }
  }

  // --------- screen shake ----------
  function screenShake() {
    document.body.classList.add('shake');
    setTimeout(() => document.body.classList.remove('shake'), 150);
  }

  // --------- hit handling ----------
  function explodeCircle() {
    stopMoving();
    const rect = circle.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    spawnExplosion(cx, cy);
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

    const x = typeof e.clientX === 'number' ? e.clientX : window.innerWidth / 2;
    const y = typeof e.clientY === 'number' ? e.clientY : window.innerHeight / 2;
    explodeCircle();
    showFloatingText('SIGNAL_DESTROYED', x, y, 'floating-hit');
  }

  if (circle) {
    circle.addEventListener('pointerdown', (e) => { e.preventDefault(); handleHit(e); }, { passive: false });
  }

  document.addEventListener('pointerup', (e) => {
    if (!gameActive || e.target === circle) return;
    const rect = circle.getBoundingClientRect();
    const dx = e.clientX - (rect.left + rect.width / 2);
    const dy = e.clientY - (rect.top + rect.height / 2);
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > rect.width * 0.6) {
      if (combo > maxCombo) maxCombo = combo;
      combo = 0;
      misses++;
      showFloatingText('TRACE_LOST', e.clientX, e.clientY, 'floating-miss');
    }
  });

  // --------- difficulty / UI ----------
  function applyDifficulty() {
    const d = DIFFICULTY[currentDifficulty] || DIFFICULTY.normal;
    circle.style.width = `${d.size}px`;
    circle.style.height = `${d.size}px`;
    chaosActive = !!d.chaos;
    matrixColor = chaosActive ? 'rgba(255,0,0,0.4)' : 'rgba(0,255,0,0.4)';
  }

  diffButtons.forEach(btn => {
    btn.addEventListener('pointerdown', () => {
      diffButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentDifficulty = btn.dataset.mode || 'normal';
      applyDifficulty();
    });
  });

  if (startButton) {
    startButton.addEventListener('pointerdown', (e) => { e.preventDefault(); startGame(); }, { passive: false });
  }

const pauseBtn = document.getElementById('pauseBtn');

if (pauseBtn) {
  pauseBtn.addEventListener('pointerdown', () => {
    togglePause();
    pauseBtn.textContent = gamePaused ? 'RESUME' : 'PAUSE';
  });
}


  // --------- timer & game flow ----------
  function updateScore() { if (scoreEl) scoreEl.textContent = `Score: ${score}`; }
  function updateTimer() { if (timerEl) timerEl.textContent = timeLeft; }

  function startTimer() {
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
      if (!gameActive) return;
      timeLeft--;
      updateTimer();
      if (timeLeft <= 0) endGame();
    }, 1000);
  }

  function startGame() {
    gamePaused = false;
    document.getElementById('pausedOverlay')?.remove();
    const pauseBtn = document.getElementById('pauseBtn');
    if (pauseBtn) { pauseBtn.style.display = 'block'; pauseBtn.textContent = 'PAUSE'; }
    score = combo = maxCombo = misses = 0;
    timeLeft = 30;
    gameActive = true;
    applyDifficulty();
    updateScore(); updateTimer();
    if (startScreen) startScreen.style.display = 'none';
    if (restartScreen) restartScreen.style.display = 'none';
    if (circle) circle.style.display = 'block';
    startMoving();
    startTimer();
    if (!matrixRAF) matrixRAF = requestAnimationFrame(drawMatrix);
    if (!explRAF && particles.length > 0) explRAF = requestAnimationFrame(explosionLoop);
  }

  function endGame() {
    gameActive = false;
    stopMoving();
    if (circle) circle.style.display = 'none';
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
    const pauseBtn = document.getElementById('pauseBtn');
    if (pauseBtn) { pauseBtn.style.display = 'none'; pauseBtn.textContent = 'PAUSE'; }
    if (!restartScreen) return;
    restartScreen.innerHTML = '';
    const title = document.createElement('div');
    title.textContent = 'GAME OVER!';
    title.style.cssText = 'font-size:clamp(24px,6vmin,48px);font-weight:bold;margin-bottom:2vmin;color:#f00;text-shadow:0 0 15px #f00,0 0 30px #f00';
    restartScreen.appendChild(title);

    const stats = document.createElement('div');
    stats.innerHTML = `Score: ${score}<br>Misses: ${misses}<br>Max Combo: ${maxCombo}`;
    stats.style.cssText = 'font-size:clamp(14px,4vmin,22px);margin-bottom:2vmin;color:#0ff;text-shadow:0 0 7.5px #0ff,0 0 15px #0ff;text-align:center';
    restartScreen.appendChild(stats);

    const btnContainer = document.createElement('div');
    btnContainer.style.cssText = 'display:flex;gap:4vmin;justify-content:center;margin-top:1.5vmin';

    const restartBtn = document.createElement('div');
    restartBtn.textContent = 'REPLAY';
    restartBtn.className = 'restart-btn';
    restartBtn.addEventListener('pointerdown', startGame);

    const backBtn = document.createElement('div');
    backBtn.textContent = 'RETURN';
    backBtn.className = 'restart-btn';
    backBtn.addEventListener('pointerdown', () => {
      restartScreen.style.display = 'none';
      if (startScreen) startScreen.style.display = 'flex';
    });

    btnContainer.appendChild(restartBtn);
    btnContainer.appendChild(backBtn);
    restartScreen.appendChild(btnContainer);

    displayHighScores(restartScreen);

    const saveScoreBtn = document.createElement('div');
    saveScoreBtn.textContent = 'SAVE SCORE';
    saveScoreBtn.className = 'restart-btn';
    saveScoreBtn.style.margin = '2vmin 0';
    restartScreen.appendChild(saveScoreBtn);

    saveScoreBtn.addEventListener('pointerdown', () => {
      saveScoreBtn.remove();
      showHighScoreInput();
    });

    restartScreen.style.display = 'flex';
    restartScreen.style.flexDirection = 'column';
    restartScreen.style.alignItems = 'center';
  }
  
  // --------- pause/resume ----------

  function pauseGame() {
  if (!gameActive || gamePaused) return;

  gamePaused = true;
  gameActive = false;
  
  const pauseBtn = document.getElementById('pauseBtn');
  if (pauseBtn) pauseBtn.textContent = 'RESUME';

  stopMoving();
  if (timerInterval) clearInterval(timerInterval);

  // Pause matrix animation
  if (matrixRAF) {
    cancelAnimationFrame(matrixRAF);
    matrixRAF = null;
  }

  // Pause explosion particles
  if (explRAF) {
    cancelAnimationFrame(explRAF);
    explRAF = null;
  }

  // ----- OVERLAY WITH RESUME & QUIT BUTTON -----
  pausedOverlay = document.createElement('div');
  pausedOverlay.id = 'pausedOverlay';
  pausedOverlay.innerHTML = `
    <div class="paused-title">PAUSED</div>
    <div id="resumeBtn" class="resume-btn">RESUME</div>
    <div id="quitBtn" class="resume-btn">QUIT</div>
  `;
  pausedOverlay.style.cssText = `
    position: fixed;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: rgba(0,0,0,0.55);
    z-index: 9999;
    user-select: none;
  `;

  document.body.appendChild(pausedOverlay);

  document.getElementById("resumeBtn").onclick = resumeGame;
  document.getElementById("quitBtn").onclick = quitToMenu;
}

// --------- resume game ----------
function resumeGame() {
  if (!gamePaused) return;

  gamePaused = false;
  gameActive = true;

  if (pausedOverlay) {
    pausedOverlay.remove();
    pausedOverlay = null;
  }

  // Resume systems
  startMoving();
  startTimer();

  if (!matrixRAF) matrixRAF = requestAnimationFrame(drawMatrix);
  if (!explRAF && particles.length > 0)
    explRAF = requestAnimationFrame(explosionLoop);

  const pauseBtn = document.getElementById('pauseBtn');
  if (pauseBtn) pauseBtn.textContent = 'PAUSE';
}

function togglePause() {
  if (gamePaused) resumeGame();
  else pauseGame();
}

// --------- quit to menu ----------
function quitToMenu() {
  // Unpause state
  gamePaused = false;
  gameActive = false;

  // Remove overlay if it exists
  if (pausedOverlay) {
    pausedOverlay.remove();
    pausedOverlay = null;
  }

  // Reset gameplay systems
  stopMoving();
  if (timerInterval) clearInterval(timerInterval);
  if (matrixRAF) {
    cancelAnimationFrame(matrixRAF);
    matrixRAF = null;
  }
  if (explRAF) {
    cancelAnimationFrame(explRAF);
    explRAF = null;
  }

  // Hide pause button
  const pauseBtn = document.getElementById("pauseBtn");
  if (pauseBtn) {
    pauseBtn.style.display = "none";
    pauseBtn.textContent = "PAUSE";
  }

  // Show the START screen again
  document.getElementById("start").style.display = "flex";

  // Hide restart screen + target circle
  document.getElementById("restart").style.display = "none";
  document.getElementById("circle").style.display = "none";
}

  // --------- highscores ----------
 function saveHighScore(initials, scoreVal) {
  const scores = JSON.parse(localStorage.getItem('highScores') || '[]');

  // Remove ANY old score with the same initials
  const filtered = scores.filter(s => s.initials !== initials);

  // Add new one
  filtered.push({
    initials,
    score: scoreVal,
    difficulty: currentDifficulty.toUpperCase()
  });

  // Sort high -> low
  filtered.sort((a, b) => b.score - a.score);

  // Keep only top 10
  localStorage.setItem('highScores', JSON.stringify(filtered.slice(0, 10)));
}


  function displayHighScores(container = restartScreen) {
    const existing = container.querySelector('.high-score-list');
    if (existing) existing.remove();
    const scores = JSON.parse(localStorage.getItem('highScores') || '[]');
    const hs = document.createElement('div');
    hs.className = 'high-score-list';
    hs.style.cssText = 'margin-top:7vmin;color:#0ff;font-size:clamp(14px,3vmin,20px);text-align:center';
    hs.innerHTML = '<strong>HIGH SCORES</strong><br>';
    if (scores.length === 0) hs.innerHTML += 'No scores yet.<br>';
    else scores.forEach((s, i) => hs.innerHTML += `${i+1}. ${s.initials} — ${s.score} / ${s.difficulty || 'UNKNOWN'}<br>`);
    container.appendChild(hs);
  }

  function showHighScoreInput() {
    if (!restartScreen) return;
    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'margin-top:2vmin;text-align:center;width:260px;max-width:80vw;margin:0 auto';
    const label = document.createElement('div');
    label.textContent = 'Enter your initials:';
    label.style.cssText = 'color:#0ff;font-size:clamp(14px,3vmin,20px);margin:1vmin 0 0.5vmin';
    const input = document.createElement('input');
    input.type = 'text';
    input.maxLength = 3;
    input.style.cssText = 'text-transform:uppercase;font-size:clamp(16px,4vmin,28px);padding:0.5em;width:6ch;text-align:center;border:2px solid #0ff;border-radius:8px;background:rgba(0,0,0,0.4);color:#0ff';
    const warning = document.createElement('div');
    warning.style.cssText = 'color:#f00;margin-top:6vmin;font-size:clamp(14px,3vmin,20px);font-weight:bold;min-height:1.5em;opacity:0;transition:opacity 0.28s';
    let warnTimer = null;
    function showWarn(t, auto=true) {
      clearTimeout(warnTimer);
      warning.textContent = t;
      warning.style.opacity = '1';
      if (auto) warnTimer = setTimeout(() => warning.style.opacity = '0', 2000);
    }
    input.addEventListener('input', () => {
      input.value = input.value.toUpperCase().replace(/[^A-Z]/g, '');
      warning.style.opacity = '0';
    });

    const saveBtn = document.createElement('div');
    saveBtn.textContent = 'SAVE SCORE';
    saveBtn.className = 'restart-btn';
    saveBtn.style.marginTop = '1.5vmin';
    saveBtn.addEventListener('pointerdown', () => {
    const raw = input.value;
    if (!raw.length) {
    showWarn('Please enter at least one letter!');
    input.focus();
    return;
    }

    const padded = raw.padEnd(3, '_');

    // Save, now overwriting old score if initials match
    saveHighScore(padded, score);

    wrapper.remove();
    displayHighScores(restartScreen);
    });

    wrapper.appendChild(label);
    wrapper.appendChild(input);
    wrapper.appendChild(saveBtn);
    wrapper.appendChild(warning);
    restartScreen.appendChild(wrapper);
    input.focus();
  }

  // --------- cleanup & dev API ----------
  function cleanup() {
    if (matrixRAF) cancelAnimationFrame(matrixRAF);
    if (explRAF) cancelAnimationFrame(explRAF);
    if (moveTimer) clearInterval(moveTimer);
    if (timerInterval) clearInterval(timerInterval);
    resizeTimer && clearTimeout(resizeTimer);
  }

  window._game = { startGame, endGame, cleanup, spawnExplosion, particles };

  // --------- init ----------
  function init() {
    resizeCanvases();
    applyDifficulty();
    updateScore(); updateTimer();
    if (!matrixRAF) matrixRAF = requestAnimationFrame(drawMatrix);
  }

  init();
})();
