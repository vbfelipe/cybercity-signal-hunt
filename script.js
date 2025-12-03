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
// DEVICE DETECTION
// ------------------------------------------------------
const isMobile = /Mobi|Android|iPhone|iPad|iPod|Windows Phone/i.test(navigator.userAgent);

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
let matrixColor = "rgba(0, 255, 0, 0.4)";

let score = 0;
let gameActive = false;
let timeLeft = 30;

let moveInterval = null;
let timerInterval = null;

const INPUT_DEBOUNCE_MS = 80;
let lastInputTime = 0;

let combo = 0;

// ------------------------------------------------------
// UI UPDATES
// ------------------------------------------------------
const updateScore = () => scoreEl.textContent = `Score: ${score}`;
const updateTimer = () => timerEl.textContent = timeLeft;

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
    t.style.left = `${x}px`;
    t.style.top = `${y}px`;
    document.body.appendChild(t);

    requestAnimationFrame(() => {
        t.style.transform = "translateY(-35px)";
        t.style.opacity = 0;
    });

    setTimeout(() => t.remove(), 850);
}

// ------------------------------------------------------
// MOVE CIRCLE
// ------------------------------------------------------
function moveCircleOnce() {
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
    clearInterval(moveInterval);

    // Adjust reaction time for desktop vs mobile
    const reactionMultiplier = isMobile ? 1 : 1.5; // desktop slower
    const adjustedDelay = MOVE_DELAY * reactionMultiplier;

    moveInterval = setInterval(() => gameActive && moveCircleOnce(), adjustedDelay);
    moveCircleOnce();
}

function stopMoving() {
    clearInterval(moveInterval);
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

// ------------------------------------------------------
// EXPLOSION EFFECT
// ------------------------------------------------------
function explodeCircle() {
    stopMoving();

    const rect = circle.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;

    for (let i = 0; i < 54; i++) {
        const p = document.createElement("div");
        p.className = "particle";
        p.style.left = `${cx}px`;
        p.style.top = `${cy}px`;
        document.body.appendChild(p);

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

// ------------------------------------------------------
// HIT HANDLING
// ------------------------------------------------------
function handleHit(e) {
    const now = performance.now();
    if (now - lastInputTime < INPUT_DEBOUNCE_MS) return;
    lastInputTime = now;

    if (!gameActive) return;

    score++;
    updateScore();

    // COMBO LOGIC
    combo++;
    if (combo > 1) {
        showComboText();
    }

    explodeCircle();
    showFloatingText("SIGNAL_DESTROYED", e.clientX, e.clientY, "floating-hit");
}

function showComboText() {
    const t = document.createElement("div");
    t.className = "floating-text floating-combo";
    t.textContent = `COMBO x${combo}`;

    // place centered at the top
    t.style.left = `50%`;
    t.style.top = `8vh`;
    t.style.transform = "translateX(-50%)";

    document.body.appendChild(t);

    requestAnimationFrame(() => {
        t.style.transform = "translate(-50%, -40px)";
        t.style.opacity = "0";
    });

    setTimeout(() => t.remove(), 850);
}

// ------------------------------------------------------
// INPUT HANDLERS
// ------------------------------------------------------
circle.addEventListener("pointerdown", e => { e.preventDefault(); handleHit(e); });

// --- MISS DETECTION + COMBO RESET ---
document.addEventListener("pointerup", e => {
    if (!gameActive) return;

    if (e.target === circle) return;

    const rect = circle.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;

    const dx = e.clientX - cx;
    const dy = e.clientY - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > rect.width * 0.6) {
        combo = 0;
        showFloatingText("TRACE_LOST", e.clientX, e.clientY, "floating-miss");
    }
});

// ------------------------------------------------------
// DIFFICULTY AND GAME CONTROL
// ------------------------------------------------------
function applyDifficulty() {
    const d = DIFFICULTY[currentDifficulty];
    MOVE_DELAY = d.delay;
    chaosActive = d.chaos;
    circle.style.width = `${d.size}px`;
    circle.style.height = `${d.size}px`;

    matrixColor = chaosActive ? "rgba(255, 0, 0, 0.4)" : "rgba(0, 255, 0, 0.4)";
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

    combo = 0;
}

function endGame() {
    gameActive = false;
    stopMoving();
    circle.style.display = "none";

    restartScreen.style.display = "flex";
    restartBox.textContent = `SCORE: ${score} — RESTART?`;
}

// ------------------------------------------------------
// BUTTONS
// ------------------------------------------------------
startButton.addEventListener("pointerdown", e => { e.preventDefault(); startGame(); });
restartBox.addEventListener("pointerdown", e => { e.preventDefault(); startGame(); });
backBox.addEventListener("pointerdown", e => {
    e.preventDefault();
    restartScreen.style.display = "none";
    startScreen.style.display = "flex";
});

diffButtons.forEach(btn => {
    btn.addEventListener("pointerdown", () => {
        diffButtons.forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        currentDifficulty = btn.dataset.mode;
    });
});

// ------------------------------------------------------
// MATRIX RAIN CANVAS
// ------------------------------------------------------
const canvas = document.getElementById('matrixCanvas');
const ctx = canvas.getContext('2d');

let width = canvas.width = window.innerWidth;
let height = canvas.height = window.innerHeight;

const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@$%&*";
const fontSize = 18;
let columns = Math.floor(width / fontSize);
const drops = Array.from({ length: columns }, () => Math.random() * height);

function drawMatrix() {
    ctx.fillStyle = chaosActive ? "rgba(0,0,0,0.12)" : "rgba(0,0,0,0.05)";
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = matrixColor;
    ctx.font = `${fontSize}px monospace`;

    for (let i = 0; i < drops.length; i++) {
        const text = letters.charAt(Math.floor(Math.random() * letters.length));
        ctx.fillText(text, i * fontSize, drops[i]);

        drops[i] += chaosActive ? fontSize * (0.8 + Math.random() * 0.5) : fontSize;

        if (drops[i] > height && Math.random() > (chaosActive ? 0.85 : 0.975)) {
            drops[i] = 0;
        }

        if (chaosActive) {
            const jitter = Math.random() * fontSize - fontSize / 2;
            ctx.fillText(text, i * fontSize + jitter, drops[i]);
        }
    }

    requestAnimationFrame(drawMatrix);
}

// ------------------------------------------------------
// RESIZE HANDLER
// ------------------------------------------------------
function resizeCanvas() {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;

    const newColumns = Math.floor(width / fontSize);

    if (newColumns > drops.length) {
        for (let i = drops.length; i < newColumns; i++) {
            drops[i] = Math.random() * height;
        }
    } else {
        drops.length = newColumns;
    }

    moveCircleOnce();
}

window.addEventListener('resize', resizeCanvas);

// ------------------------------------------------------
// START MATRIX ANIMATION
// ------------------------------------------------------
drawMatrix();
