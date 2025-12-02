// ELEMENTS
const circle = document.getElementById("circle");
const scoreEl = document.getElementById("score");
const timerEl = document.getElementById("timer");

const startScreen = document.getElementById("start");
const startButton = document.getElementById("startButton");

const restartScreen = document.getElementById("restart");
const restartBox = document.getElementById("restartBox");
const backBox = document.getElementById("backBox");

const diffButtons = document.querySelectorAll(".diff-btn");

// DIFFICULTY
let currentDifficulty = "normal";

const DIFFICULTY = {
    easy:   { delay: 750, size: 90, chaos: false },
    normal: { delay: 650, size: 60, chaos: false },
    hard:   { delay: 550, size: 40, chaos: false },
    chaos:  { delay: 450, size: 30, chaos: true }
};

let MOVE_DELAY = DIFFICULTY.normal.delay;
let chaosActive = false;

let score = 0;
let gameActive = false;
let timeLeft = 30;

let moveInterval = null;
let timerInterval = null;

let lastInputTime = 0;
const INPUT_DEBOUNCE_MS = 80;

// UI
const updateScore = () => (scoreEl.textContent = `Score: ${score}`);
const updateTimer = () => (timerEl.textContent = timeLeft);

// SCREEN SHAKE
function screenShake() {
    document.body.classList.add("shake");
    setTimeout(() => document.body.classList.remove("shake"), 150);
}

// FLOATING TEXT
function showFloatingText(text, x, y, css) {
    const t = document.createElement("div");
    t.className = `floating-text ${css}`;
    t.textContent = text;
    t.style.left = x + "px";
    t.style.top = y + "px";
    document.body.appendChild(t);
    requestAnimationFrame(() => {
        t.style.transform = "translateY(-35px)";
        t.style.opacity = 0;
    });
    setTimeout(() => t.remove(), 850);
}

// MOVE CIRCLE
function moveCircleOnce() {
    const size = circle.offsetWidth;
    const pad = 10;
    let x = Math.random() * (window.innerWidth - size - pad * 2) + pad;
    let y = Math.random() * (window.innerHeight - size - pad * 2) + pad;
    x = Math.min(Math.max(x, pad), window.innerWidth - size - pad);
    y = Math.min(Math.max(y, pad), window.innerHeight - size - pad);
    circle.style.left = `${x}px`;
    circle.style.top = `${y}px`;

    if (chaosActive && Math.random() < 0.12) {
        document.body.classList.add("chaos-flash");
        setTimeout(() => document.body.classList.remove("chaos-flash"), 120);
    }
}

function startMoving() {
    clearInterval(moveInterval);
    moveInterval = setInterval(() => gameActive && moveCircleOnce(), MOVE_DELAY);
    moveCircleOnce();
}

function stopMoving() { clearInterval(moveInterval); }

// TIMER
function startTimer() {
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        if (!gameActive) return;
        timeLeft--;
        updateTimer();
        if (timeLeft <= 0) endGame();
    }, 1000);
}

// EXPLOSION
function explodeCircle() {
    stopMoving();
    const rect = circle.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;

    for (let i = 0; i < 18; i++) {
        const p = document.createElement("div");
        p.className = "particle";
        document.body.appendChild(p);
        p.style.left = `${cx}px`;
        p.style.top = `${cy}px`;
        const angle = Math.random() * Math.PI * 2;
        const dist = 80 + Math.random() * 70;
        const dx = Math.cos(angle) * dist;
        const dy = Math.sin(angle) * dist;
        requestAnimationFrame(() => {
            p.style.transform = `translate(${dx}px, ${dy}px) scale(0.4)`;
            p.style.opacity = 0;
        });
        setTimeout(() => p.remove(), 700);
    }

    circle.style.opacity = 0;
    setTimeout(() => {
        circle.style.opacity = 1;
        startMoving();
    }, 150);

    screenShake();
}

// HIT
function handleHit(e) {
    const now = performance.now();
    if (now - lastInputTime < INPUT_DEBOUNCE_MS) return;
    lastInputTime = now;
    if (!gameActive) return;
    score++;
    updateScore();
    explodeCircle();
    showFloatingText("SIGNAL_DESTROYED", e.clientX, e.clientY, "floating-hit");
}

// TOUCH/CLICK HANDLING
circle.addEventListener("pointerdown", e => { e.preventDefault(); handleHit(e); });
document.addEventListener("pointerdown", e => {
    if (!gameActive) return;
    if (e.target !== circle) showFloatingText("TRACE_LOST", e.clientX, e.clientY, "floating-miss");
});

// START/RESTART
function applyDifficulty() {
    const d = DIFFICULTY[currentDifficulty];
    MOVE_DELAY = d.delay;
    chaosActive = d.chaos;
    circle.style.width = d.size + "px";
    circle.style.height = d.size + "px";
}

function startGame() {
    score = 0;
    timeLeft = 30;
    gameActive = true;
    applyDifficulty();
    updateScore();
    updateTimer();
    startScreen.style.display = "none";
    restartScreen.style.display = "none";
    circle.style.display = "block";
    startMoving();
    startTimer();
}

function endGame() {
    gameActive = false;
    stopMoving();
    circle.style.display = "none";
    restartScreen.style.display = "flex";
    restartBox.textContent = `SCORE: ${score} — RESTART?`;
}

// BUTTONS
startButton.addEventListener("pointerdown", e => { e.preventDefault(); startGame(); });
restartBox.addEventListener("pointerdown", e => { e.preventDefault(); startGame(); });
backBox.addEventListener("pointerdown", e => { e.preventDefault(); restartScreen.style.display = "none"; startScreen.style.display = "flex"; });

// DIFFICULTY SELECT
diffButtons.forEach(btn => {
    btn.addEventListener("pointerdown", () => {
        diffButtons.forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        currentDifficulty = btn.dataset.mode;
    });
});

// RESIZE SAFETY
window.addEventListener("resize", () => moveCircleOnce());
