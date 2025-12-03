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
let score = 0, timeLeft = 30, gameActive = false;
let combo = 0, maxCombo = 0, misses = 0;
let moveInterval = null, timerInterval = null;
const INPUT_DEBOUNCE_MS = 80;
let lastInputTime = 0;

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

function showComboText() {
    if (combo < 2) return;
    const t = document.createElement("div");
    t.className = "floating-text floating-combo";
    t.textContent = `COMBO x${combo}`;
    t.style.left = "50%";
    t.style.top = "8vh";
    t.style.transform = "translateX(-50%)";
    document.body.appendChild(t);

    requestAnimationFrame(() => {
        t.style.transform = "translate(-50%, -40px)";
        t.style.opacity = 0;
    });
    setTimeout(() => t.remove(), 850);
}

// ------------------------------------------------------
// MOVE CIRCLE
// ------------------------------------------------------
function moveCircleOnce() {
    const size = circle.offsetWidth, pad = 10;
    let x = Math.random() * (window.innerWidth - size - pad*2) + pad;
    let y = Math.random() * (window.innerHeight - size - pad*2) + pad;
    x = Math.min(Math.max(x, pad), window.innerWidth - size - pad);
    y = Math.min(Math.max(y, pad), window.innerHeight - size - pad);
    circle.style.left = `${x}px`;
    circle.style.top = `${y}px`;
}

function startMoving() {
    clearInterval(moveInterval);
    const reactionMultiplier = isMobile ? 1 : 1.5;
    const adjustedDelay = MOVE_DELAY * reactionMultiplier;
    moveInterval = setInterval(() => gameActive && moveCircleOnce(), adjustedDelay);
    moveCircleOnce();
}

function stopMoving() { clearInterval(moveInterval); }

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
    combo++;
    if (combo > maxCombo) maxCombo = combo;
    updateScore();
    showComboText();
    explodeCircle();
    showFloatingText("SIGNAL_DESTROYED", e.clientX, e.clientY, "floating-hit");
}

// ------------------------------------------------------
// INPUT HANDLERS
// ------------------------------------------------------
circle.addEventListener("pointerdown", e => { e.preventDefault(); handleHit(e); });

document.addEventListener("pointerup", e => {
    if (!gameActive || e.target === circle) return;
    const rect = circle.getBoundingClientRect();
    const dx = e.clientX - (rect.left + rect.width/2);
    const dy = e.clientY - (rect.top + rect.height/2);
    const dist = Math.sqrt(dx*dx + dy*dy);
    if (dist > rect.width*0.6) {
        if (combo > maxCombo) maxCombo = combo;
        combo = 0;
        misses++;
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
    matrixColor = chaosActive ? "rgba(255,0,0,0.4)" : "rgba(0,255,0,0.4)";
}

function startGame() {
    score = combo = maxCombo = misses = 0;
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

// ------------------------------------------------------
// HIGH SCORE FUNCTIONS
// ------------------------------------------------------
function saveHighScore(initials, score) {
    const scores = JSON.parse(localStorage.getItem("highScores") || "[]");

    // Add new score
    scores.push({ initials, score });

    // Sort by highest score
    scores.sort((a, b) => b.score - a.score);

    // Keep only top 10
    const trimmed = scores.slice(0, 10);

    // Save back to localStorage
    localStorage.setItem("highScores", JSON.stringify(trimmed));
}

function displayHighScores(container = restartScreen) {
    const scores = JSON.parse(localStorage.getItem("highScores") || "[]");

    // Remove previous container if exists
    const old = container.querySelector(".high-score-list");
    if(old) old.remove();

    const hsContainer = document.createElement("div");
    hsContainer.className = "high-score-list";
    hsContainer.style.marginTop = "2vmin";
    hsContainer.style.color = "#0ff";
    hsContainer.style.fontSize = "clamp(14px,3vmin,22px)";
    hsContainer.style.textAlign = "center";

    hsContainer.innerHTML = "<strong>HIGH SCORES:</strong><br>";

    if(scores.length === 0) hsContainer.innerHTML += "No scores yet.";
    else scores.forEach((s,i) => hsContainer.innerHTML += `${i+1}. ${s.initials} — ${s.score}<br>`);

    container.appendChild(hsContainer);
}

function showHighScoreInput() {
    const scoreInputContainer = document.createElement("div");
    scoreInputContainer.style.marginTop = "2vmin";
    scoreInputContainer.style.textAlign = "center";

    // Label
    const label = document.createElement("div");
    label.textContent = "Enter your initials (3 letters A-Z):";
    label.style.color = "#0ff";
    label.style.fontSize = "clamp(14px,3vmin,20px)";
    label.style.marginBottom = "1vmin";

    // Input
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

    // Allow only A-Z
    input.addEventListener("input", () => {
        input.value = input.value.toUpperCase().replace(/[^A-Z]/g, "");
        clearWarning();
    });

    // Warning - with fade + fixed height
    const warning = document.createElement("div");
    warning.style.color = "#f00";
    warning.style.marginTop = "4vmin";
    warning.style.fontSize = "clamp(14px,3vmin,20px)";
    warning.style.minHeight = "1.5em";
    warning.style.opacity = 0;
    warning.style.transition = "opacity 0.3s ease";

    let warningTimer = null;

    function clearWarning() {
        if (warningTimer) clearTimeout(warningTimer);
        warningTimer = null;
        warning.textContent = "";
        warning.style.opacity = 0;
    }

    function showWarning(text) {
        clearWarning();
        warning.textContent = text;
        requestAnimationFrame(() => {
            warning.style.opacity = 1;
        });
        warningTimer = setTimeout(() => {
            warning.style.opacity = 0;
            warningTimer = null;
        }, 2000);
    }

    // Save button
    const saveBtn = document.createElement("div");
    saveBtn.textContent = "SAVE SCORE";
    saveBtn.className = "restart-btn";
    saveBtn.style.marginTop = "1.5vmin";

    saveBtn.addEventListener("pointerdown", () => {
        const raw = input.value;

        if (raw.length === 0) {
            showWarning("Please enter at least one letter!");
            return;
        }

        const padded = raw.padEnd(3, "_"); // ALWAYS compare padded

        const scores = JSON.parse(localStorage.getItem("highScores") || "[]");
        const exists = scores.some(s => s.initials === padded);

        if (exists) {
            showWarning("Please choose another name!");
            return;
        }

        saveHighScore(padded, score);
        scoreInputContainer.remove();
        displayHighScores();
    });

    // Append
    scoreInputContainer.appendChild(label);
    scoreInputContainer.appendChild(input);
    scoreInputContainer.appendChild(saveBtn);
    scoreInputContainer.appendChild(warning);

    restartScreen.appendChild(scoreInputContainer);
    input.focus();
}

// ------------------------------------------------------
// END GAME
// ------------------------------------------------------
function endGame() {
    gameActive = false;
    stopMoving();
    circle.style.display = "none";

    restartScreen.innerHTML = "";

    // Title
    const title = document.createElement("div");
    title.textContent = "GAME OVER!";
    title.style.fontSize = "clamp(24px,6vmin,48px)";
    title.style.fontWeight = "bold";
    title.style.marginBottom = "2vmin";
    title.style.color = "#f00";
    title.style.textShadow = "0 0 15px #f00,0 0 30px #f00";
    restartScreen.appendChild(title);

    // Stats
    const stats = document.createElement("div");
    stats.innerHTML = `Score: ${score}<br>Misses: ${misses}<br>Max Combo: ${maxCombo}`;
    stats.style.fontSize = "clamp(14px,4vmin,22px)";
    stats.style.marginBottom = "3vmin";
    stats.style.color = "#0ff";
    stats.style.textShadow = "0 0 7.5px #0ff,0 0 15px #0ff";
    stats.style.textAlign = "center";
    restartScreen.appendChild(stats);

    // Restart & Back buttons
    const btnContainer = document.createElement("div");
    btnContainer.style.display = "flex";
    btnContainer.style.gap = "4vmin";
    btnContainer.style.justifyContent = "center";

    const restartBtn = document.createElement("div");
    restartBtn.textContent = "RESTART";
    restartBtn.className = "restart-btn";
    restartBtn.addEventListener("pointerdown", startGame);

    const backBtn = document.createElement("div");
    backBtn.textContent = "BACK";
    backBtn.className = "restart-btn";
    backBtn.addEventListener("pointerdown", () => {
        restartScreen.style.display = "none";
        startScreen.style.display = "flex";
    });

    btnContainer.appendChild(restartBtn);
    btnContainer.appendChild(backBtn);
    restartScreen.appendChild(btnContainer);

    // Save score button
    const saveScoreBtn = document.createElement("div");
    saveScoreBtn.textContent = "Save Score";
    saveScoreBtn.className = "restart-btn";
    saveScoreBtn.style.marginBottom = "2vmin";
    restartScreen.appendChild(saveScoreBtn);

    saveScoreBtn.addEventListener("pointerdown", () => {
        saveScoreBtn.remove();
        showHighScoreInput();
    });

    displayHighScores();
    restartScreen.style.display = "flex";
    restartScreen.style.flexDirection = "column";
    restartScreen.style.alignItems = "center";
}

// ------------------------------------------------------
// BUTTONS
// ------------------------------------------------------
startButton.addEventListener("pointerdown", e => { e.preventDefault(); startGame(); });
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
const drops = Array.from({length: columns}, () => Math.random()*height);

function drawMatrix() {
    ctx.fillStyle = chaosActive ? "rgba(0,0,0,0.12)" : "rgba(0,0,0,0.05)";
    ctx.fillRect(0,0,width,height);
    ctx.fillStyle = matrixColor;
    ctx.font = `${fontSize}px monospace`;

    for (let i=0;i<drops.length;i++){
        const text = letters.charAt(Math.floor(Math.random()*letters.length));
        ctx.fillText(text, i*fontSize, drops[i]);
        drops[i] += chaosActive ? fontSize*(0.8 + Math.random()*0.5) : fontSize;

        if(drops[i] > height && Math.random() > (chaosActive ? 0.85 : 0.975)) drops[i] = 0;

        if(chaosActive){
            const jitter = Math.random()*fontSize - fontSize/2;
            ctx.fillText(text, i*fontSize + jitter, drops[i]);
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
    if(newColumns > drops.length){
        for(let i=drops.length;i<newColumns;i++) drops[i] = Math.random()*height;
    } else drops.length = newColumns;

    moveCircleOnce();
}
window.addEventListener('resize', resizeCanvas);

// ------------------------------------------------------
// START MATRIX
// ------------------------------------------------------
drawMatrix();
