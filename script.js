// ------------------------------------------------------
// ELEMENTS
// ------------------------------------------------------
const circle = document.getElementById("circle");
const scoreEl = document.getElementById("score");
const timerEl = document.getElementById("timer");

const startScreen = document.getElementById("start");
const startButton = document.getElementById("startButton");

const restartScreen = document.getElementById("restart");
const restartBox = document.getElementById("restartBox");
const backBox = document.getElementById("backBox");

const diffButtons = document.querySelectorAll(".diff-btn");

// ------------------------------------------------------
// DIFFICULTY SETTINGS
// ------------------------------------------------------
let currentDifficulty = "normal";

const DIFFICULTY = {
    easy:   { delay: 900, size: 90, chaos: false },
    normal: { delay: 700, size: 60, chaos: false },
    hard:   { delay: 500, size: 45, chaos: false },
    chaos:  { delay: 300, size: 60, chaos: true }
};

let chaosActive = false;
let MOVE_DELAY = DIFFICULTY.normal.delay;

// ------------------------------------------------------
// GAME STATE
// ------------------------------------------------------
let score = 0;
let gameActive = false;
let timeLeft = 30;

let moveInterval = null;
let timerInterval = null;

let lastInputTime = 0;
const INPUT_DEBOUNCE_MS = 80;

// ------------------------------------------------------
// UI helpers
// ------------------------------------------------------
const updateScore = () => (scoreEl.textContent = `Score: ${score}`);
const updateTimer = () => (timerEl.textContent = timeLeft);

// ------------------------------------------------------
// SCREEN SHAKE
// ------------------------------------------------------
function screenShake() {
    document.body.classList.add("shake");
    setTimeout(() => document.body.classList.remove("shake"), 150);
}

// ------------------------------------------------------
// FLOATING TEXT
// ------------------------------------------------------
function showFloatingText(text, x, y, cssClass) {
    const t = document.createElement("div");
    t.className = `floating-text ${cssClass}`;
    t.textContent = text;

    const offsetX = (Math.random() - 0.5) * 40;
    const offsetY = (Math.random() - 0.5) * 40;

    t.style.left = `${x + offsetX}px`;
    t.style.top = `${y + offsetY}px`;

    document.body.appendChild(t);

    requestAnimationFrame(() => {
        t.style.transform = "translateY(-28px)";
        t.style.opacity = 0;
    });

    setTimeout(() => t.remove(), 900);
}

// ------------------------------------------------------
// CIRCLE MOVEMENT
// ------------------------------------------------------
function moveCircleOnce() {
    const size = circle.offsetWidth || 60;
    const pad = 10;

    const x = Math.random() * (window.innerWidth - size - pad * 2) + pad;
    const y = Math.random() * (window.innerHeight - size - pad * 2) + pad;

    circle.style.left = `${x}px`;
    circle.style.top = `${y}px`;

    // Chaos flash small chance
    if (chaosActive && Math.random() < 0.12) {
        document.body.classList.add("chaos-flash");
        setTimeout(() => document.body.classList.remove("chaos-flash"), 120);
    }
}

function startMoving() {
    clearInterval(moveInterval);
    moveInterval = setInterval(() => {
        if (gameActive) moveCircleOnce();
    }, MOVE_DELAY);

    moveCircleOnce();
}

function stopMoving() {
    clearInterval(moveInterval);
    moveInterval = null;
}

// ------------------------------------------------------
// TIMER
// ------------------------------------------------------
function startTimer() {
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        if (!gameActive) return;
        timeLeft--;
        updateTimer();
        if (timeLeft <= 0) endGame();
    }, 1000);
}
function stopTimer() {
    clearInterval(timerInterval);
    timerInterval = null;
}

// ------------------------------------------------------
// EXPLOSION (particles)
 // same behavior, sizes are responsive thanks to CSS clamp
// ------------------------------------------------------
function explodeCircle() {
    stopMoving();

    const rect = circle.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;

    const count = 18;
    for (let i = 0; i < count; i++) {
        const p = document.createElement("div");
        p.className = "particle";
        document.body.appendChild(p);

        p.style.left = `${cx}px`;
        p.style.top = `${cy}px`;

        const angle = Math.random() * Math.PI * 2;
        const dist = 80 + Math.random() * 70;

        const dx = Math.cos(angle) * dist;
        const dy = Math.sin(angle) * dist;

        const scale = 0.4 + Math.random() * 0.4;

        requestAnimationFrame(() => {
            p.style.transform = `translate(${dx}px, ${dy}px) scale(${scale})`;
            p.style.opacity = 0;
        });

        setTimeout(() => p.remove(), 700);
    }

    circle.style.opacity = 0;

    setTimeout(() => {
        moveCircleOnce();
        circle.style.opacity = 1;
        startMoving();
    }, 150);

    screenShake();
}

// ------------------------------------------------------
// HIT
// ------------------------------------------------------
function handleHit(e) {
    const now = performance.now();
    if (now - lastInputTime < INPUT_DEBOUNCE_MS) return;
    lastInputTime = now;

    if (!gameActive) return;

    score++;
    updateScore();
    explodeCircle();

    showFloatingText("SIGNAL_DESTROYED()", e.clientX, e.clientY, "floating-hit");
}

circle.addEventListener("pointerdown", e => {
    e.preventDefault();
    handleHit(e);
}, { passive: false });

// ------------------------------------------------------
// MISS (don't show miss when start screen is visible)
 // ignore clicks on UI elements (we only trigger miss when gameActive)
 // also ignore pointerdown if target is interactive element (button/diff)
 // ------------------------------------------------------
document.addEventListener("pointerdown", e => {
    if (!gameActive) return;

    // if clicking on the circle itself, that's handled by circle listener
    if (e.target === circle) return;

    // if clicking a control overlay accidentally (rare during gameplay), ignore
    if (e.target.closest('#start') || e.target.closest('#restart')) return;

    showFloatingText("TRACE_LOST()", e.clientX, e.clientY, "floating-miss");
});

// ------------------------------------------------------
// DIFFICULTY application (keeps original sizes but allows CSS clamp)
 // apply size in px, but CSS clamp will respect min/max
// ------------------------------------------------------
let currentBtn = document.querySelector('.diff-btn.active');
function applyDifficulty(mode) {
    currentDifficulty = mode;
    const d = DIFFICULTY[mode];

    MOVE_DELAY = d.delay;
    chaosActive = d.chaos;

    // set circle size (JS sets preferred px; CSS clamp still enforces min/max)
    circle.style.width = d.size + "px";
    circle.style.height = d.size + "px";
}

// init difficulty buttons
diffButtons.forEach(btn => {
    btn.addEventListener('pointerdown', (ev) => {
        ev.preventDefault();
        diffButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        applyDifficulty(btn.dataset.mode);
    }, { passive: false });

    // accessibility: keyboard select
    btn.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter' || ev.key === ' ') {
            ev.preventDefault();
            btn.click();
        }
    });
});

// set default difficulty
applyDifficulty(currentDifficulty);

// ------------------------------------------------------
// GAME FLOW
// ------------------------------------------------------
function startGame(startTime = 30) {
    score = 0;
    timeLeft = startTime;
    gameActive = true;

    updateScore();
    updateTimer();

    startScreen.style.display = "none";
    restartScreen.style.display = "none";

    circle.style.display = "block";
    circle.style.opacity = 1;

    startMoving();
    startTimer();
}

function endGame() {
    gameActive = false;

    stopMoving();
    stopTimer();

    circle.style.display = "none";

    restartScreen.style.display = "flex";
    restartBox.textContent = `SCORE: ${score} — RESTART?`;
}

// ------------------------------------------------------
// BUTTONS (start / restart / back)
 // add keyboard support
// ------------------------------------------------------
startButton.addEventListener("pointerdown", e => {
    e.preventDefault();
    startGame();
}, { passive: false });
startButton.addEventListener('keydown', e => { if (e.key === 'Enter') startGame(); });

restartBox.addEventListener("pointerdown", e => {
    e.preventDefault();
    startGame();
}, { passive: false });

backBox.addEventListener("pointerdown", e => {
    e.preventDefault();
    restartScreen.style.display = "none";
    startScreen.style.display = "flex";
}, { passive: false });

// ------------------------------------------------------
// RESIZE safety: keep circle inside viewport when viewport changes
// ------------------------------------------------------
window.addEventListener("resize", () => {
    if (circle.style.display === "none") return;

    const size = circle.offsetWidth;
    const left = parseFloat(circle.style.left) || 0;
    const top = parseFloat(circle.style.top) || 0;

    const maxX = window.innerWidth - size - 10;
    const maxY = window.innerHeight - size - 10;

    if (left > maxX) circle.style.left = `${maxX}px`;
    if (top > maxY) circle.style.top = `${maxY}px`;
});
