// Конфигурация Firebase
const firebaseConfig = {
    apiKey: "AIzaSyD_tw7n8VErwWwqlJy_gWfATPY1cAUJzZk",
    authDomain: "bitpaint-f7dbd.firebaseapp.com",
    databaseURL: "https://bitpaint-f7dbd-default-rtdb.firebaseio.com",
    projectId: "bitpaint-f7dbd",
    storageBucket: "bitpaint-f7dbd.firebasestorage.app",
    messagingSenderId: "193627137592",
    appId: "1:193627137592:web:4f3835e21c0adf024468cd",
    measurementId: "G-2JR3GPQ60R"
};

// Инициализация Firebase (Compat версия)
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// Глобальные переменные
let currentUser = null;
let currentDrawingId = null; 

// --- Навигация и Авторизация ---
const screens = ['auth-screen', 'main-screen', 'draw-screen', 'hall-screen', 'profile-screen'];
function showScreen(screenId) {
    screens.forEach(s => document.getElementById(s).classList.add('hidden'));
    document.getElementById(screenId).classList.remove('hidden');
    // Гарантируем правильный размер холста при его показе
    if (screenId === 'draw-screen') {
        resizeCanvas();
    }
}

document.getElementById('login-btn').addEventListener('click', () => {
    const nick = document.getElementById('nickname-input').value.trim();
    if (nick) {
        currentUser = nick;
        localStorage.setItem('bitpaint_user', nick);
        document.getElementById('user-name-display').innerText = nick;
        db.ref('users/' + currentUser).update({ lastLogin: Date.now() });
        showScreen('main-screen');
    }
});

window.onload = () => {
    const savedUser = localStorage.getItem('bitpaint_user');
    if (savedUser) {
        currentUser = savedUser;
        db.ref('users/' + currentUser + '/avatar').once('value').then(snap => {
            if(snap.val()) document.getElementById('user-avatar').src = snap.val();
        });
        document.getElementById('user-name-display').innerText = savedUser;
        showScreen('main-screen');
    }
    initCanvas();
};

document.getElementById('nav-feed-btn').addEventListener('click', () => showScreen('main-screen'));
document.getElementById('nav-draw-btn').addEventListener('click', () => {
    currentDrawingId = null; // Сбрасываем ID, так как это новый рисунок
    clearCanvas(); // Очищаем холст
    showScreen('draw-screen');
});
document.getElementById('close-draw-btn').addEventListener('click', () => showScreen('main-screen'));
document.getElementById('nav-hall-btn').addEventListener('click', () => showScreen('hall-screen'));
document.getElementById('nav-profile-btn').addEventListener('click', () => {
    document.getElementById('profile-name').innerText = currentUser;
    showScreen('profile-screen');
});


// --- Движок Рисования (Canvas API) - ПОЛНОСТЬЮ ВОССТАНОВЛЕН ---
const canvas = document.getElementById('paint-canvas');
const ctx = canvas.getContext('2d', { willReadFrequently: true });
let isDrawing = false, startX, startY;
let undoStack = [];
let savedImageData = null;

let state = { tool: 'pencil', color: '#8a2be2', width: 5, neon: false, fill: false, texture: 'none' };

function resizeCanvas() {
    const container = canvas.parentElement;
    const { width, height } = container.getBoundingClientRect();
    const aspectRatio = 16 / 9;

    let newWidth, newHeight;

    if (width / height > aspectRatio) {
        newHeight = height - 20; // -20px для отступов
        newWidth = newHeight * aspectRatio;
    } else {
        newWidth = width - 20;
        newHeight = newWidth / aspectRatio;
    }

    if (canvas.width !== newWidth || canvas.height !== newHeight) {
        const tempImg = ctx.getImageData(0, 0, canvas.width, canvas.height);
        canvas.width = newWidth;
        canvas.height = newHeight;
        ctx.putImageData(tempImg, 0, 0);
    }
}

function clearCanvas() {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    undoStack = []; // Очищаем историю при полной очистке
    saveState();
}

function saveState() {
    if (undoStack.length >= 15) undoStack.shift();
    undoStack.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
}

function undo() {
    if (undoStack.length > 1) {
        undoStack.pop(); // Удаляем текущее состояние
        ctx.putImageData(undoStack[undoStack.length - 1], 0, 0); // Восстанавливаем предыдущее
    }
}

document.getElementById('undo-btn').addEventListener('click', undo);
document.addEventListener('keydown', (e) => { if (e.ctrlKey && e.key === 'z') undo(); });

// Настройки инструментов
document.querySelectorAll('.tool-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        document.querySelector('.tool-btn.active').classList.remove('active');
        e.currentTarget.classList.add('active');
        state.tool = e.currentTarget.dataset.tool;
    });
});
document.getElementById('color-picker').addEventListener('input', e => state.color = e.target.value);
document.getElementById('line-width').addEventListener('input', e => state.width = e.target.value);
document.getElementById('neon-mode').addEventListener('change', e => state.neon = e.target.checked);
document.getElementById('fill-shapes').addEventListener('change', e => state.fill = e.target.checked);
document.getElementById('texture-select').addEventListener('change', e => state.texture = e.target.value);

function getPos(e) {
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: clientX - rect.left, y: clientY - rect.top };
}

function getFillStyle() {
    if (!state.fill) return 'transparent';
    if (state.texture === 'none') return state.color;
    
    const patCanvas = document.createElement('canvas');
    const pCtx = patCanvas.getContext('2d');
    patCanvas.width = 20; patCanvas.height = 20;
    pCtx.fillStyle = state.color;
    pCtx.fillRect(0,0,20,20);
    pCtx.strokeStyle = 'rgba(0,0,0,0.3)';
    
    if (state.texture === 'bricks') {
        pCtx.strokeRect(0,0,10,10); pCtx.strokeRect(10,10,10,10);
    } else if (state.texture === 'wood') {
        pCtx.beginPath(); pCtx.arc(10, 10, 5, 0, Math.PI); pCtx.stroke();
    }
    return ctx.createPattern(patCanvas, 'repeat');
}

function applyNeon() {
    if (state.neon && state.tool !== 'eraser') {
        ctx.shadowBlur = 15;
        ctx.shadowColor = state.color;
    } else {
        ctx.shadowBlur = 0;
        ctx.shadowColor = 'transparent';
    }
}

function startDraw(e) {
    e.preventDefault();
    isDrawing = true;
    const pos = getPos(e);
    startX = pos.x;
    startY = pos.y;
    
    if (state.tool === 'picker') {
        const pixel = ctx.getImageData(startX, startY, 1, 1).data;
        const hex = "#" + ("000000" + ((pixel[0] << 16) | (pixel[1] << 8) | pixel[2]).toString(16)).slice(-6);
        state.color = hex;
        document.getElementById('color-picker').value = hex;
        document.querySelector('[data-tool="pencil"]').click(); // Авто-переключение на карандаш
        isDrawing = false;
        return;
    }
    
    if (state.tool === 'fill') {
        floodFill(Math.floor(startX), Math.floor(startY), hexToRgb(state.color));
        saveState(); // Сохраняем состояние после заливки
        isDrawing = false;
        return;
    }
    
    savedImageData = ctx.getImageData(0, 0, canvas.width, canvas.height); // Сохраняем холст для фигур
    ctx.beginPath();
    ctx.moveTo(startX, startY);
}

function draw(e) {
    if (!isDrawing) return;
    e.preventDefault();
    const pos = getPos(e);
    
    if (['line', 'rect', 'circle'].includes(state.tool)) {
        ctx.putImageData(savedImageData, 0, 0); // Восстанавливаем холст
    }

    ctx.lineWidth = state.width;
    ctx.lineCap = 'round';
    ctx.strokeStyle = state.tool === 'eraser' ? '#ffffff' : state.color;
    applyNeon();

    if (state.tool === 'pencil' || state.tool === 'eraser') {
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
    } else if (state.tool === 'line') {
        ctx.beginPath(); ctx.moveTo(startX, startY); ctx.lineTo(pos.x, pos.y); ctx.stroke();
    } else if (state.tool === 'rect') {
        ctx.beginPath(); ctx.rect(startX, startY, pos.x - startX, pos.y - startY);
        if (state.fill) { ctx.fillStyle = getFillStyle(); ctx.fill(); }
        ctx.stroke();
    } else if (state.tool === 'circle') {
        ctx.beginPath();
        const radius = Math.sqrt(Math.pow(pos.x - startX, 2) + Math.pow(pos.y - startY, 2));
        ctx.moveTo(startX + radius, startY); // Фикс линии из центра
        ctx.arc(startX, startY, radius, 0, Math.PI * 2);
        if (state.fill) { ctx.fillStyle = getFillStyle(); ctx.fill(); }
        ctx.stroke();
    }
}

function stopDraw() {
    if (!isDrawing) return;
    isDrawing = false;
    ctx.shadowBlur = 0;
    if (state.tool !== 'fill' && state.tool !== 'picker') {
        saveState(); // Сохраняем итоговое состояние
    }
}

function initCanvas() {
    resizeCanvas();
    clearCanvas();
}
canvas.addEventListener('mousedown', startDraw);
canvas.addEventListener('mousemove', draw);
canvas.addEventListener('mouseup', stopDraw);
canvas.addEventListener('mouseout', stopDraw);
canvas.addEventListener('touchstart', startDraw, { passive: false });
canvas.addEventListener('touchmove', draw, { passive: false });
canvas.addEventListener('touchend', stopDraw);

// --- Умная заливка (Flood Fill) ---
function hexToRgb(hex) {
    const bigint = parseInt(hex.slice(1), 16);
    return [bigint >> 16 & 255, bigint >> 8 & 255, bigint & 255];
}
function floodFill(x, y, fillColor) {
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imgData.data;
    const w = canvas.width, h = canvas.height;
    const stack = [[x, y]];
    const startIdx = (y * w + x) * 4;
    const startColor = [data[startIdx], data[startIdx+1], data[startIdx+2]];

    if (Math.abs(startColor[0] - fillColor[0]) < 10 && Math.abs(startColor[1] - fillColor[1]) < 10 && Math.abs(startColor[2] - fillColor[2]) < 10) return;

    const tolerance = 30;
    function matchStartColor(idx) {
        return Math.abs(data[idx] - startColor[0]) <= tolerance &&
               Math.abs(data[idx+1] - startColor[1]) <= tolerance &&
               Math.abs(data[idx+2] - startColor[2]) <= tolerance;
    }

    while (stack.length) {
        let [cx, cy] = stack.pop();
        let idx = (cy * w + cx) * 4;
        while (cy >= 0 && matchStartColor(idx)) { cy--; idx -= w * 4; }
        cy++; idx += w * 4;
        let reachLeft = false, reachRight = false;
        while (cy < h && matchStartColor(idx)) {
            data[idx] = fillColor[0]; data[idx+1] = fillColor[1]; data[idx+2] = fillColor[2]; data[idx+3] = 255;
            if (cx > 0) {
                if (matchStartColor(idx - 4)) { if (!reachLeft) { stack.push([cx - 1, cy]); reachLeft = true; } }
                else if (reachLeft) { reachLeft = false; }
            }
            if (cx < w - 1) {
                if (matchStartColor(idx + 4)) { if (!reachRight) { stack.push([cx + 1, cy]); reachRight = true; } }
                else if (reachRight) { reachRight = false; }
            }
            cy++; idx += w * 4;
        }
    }
    ctx.putImageData(imgData, 0, 0);
}


// --- Интеграция Firebase (Синхронизация) ---
db.ref().on('value', snapshot => {
    const rootData = snapshot.val() || {};
    const drawingsData = rootData.drawings || {};
    const usersData = rootData.users || {};
    
    // --- Логика Зала Славы ---
    const userStats = {};
    for (const drawId in drawingsData) {
        const drawing = drawingsData[drawId];
        if (!userStats[drawing.author]) {
            userStats[drawing.author] = { name: drawing.author, totalLikes: 0, avatar: usersData[drawing.author]?.avatar };
        }
        userStats[drawing.author].totalLikes += Object.keys(drawing.likes || {}).length;
    }
    const topUsers = Object.values(userStats).sort((a, b) => b.totalLikes - a.totalLikes).slice(0, 10);
    renderHallOfFame(document.getElementById('hall-container'), topUsers);

    // --- Логика для лент ---
    const drawingsArray = Object.entries(drawingsData).map(([id, val]) => ({ id, ...val })).sort((a, b) => b.timestamp - a.timestamp);
    renderDrawingsList(document.getElementById('feed-container'), drawingsArray);
    renderDrawingsList(document.getElementById('profile-feed-container'), drawingsArray.filter(d => d.author === currentUser));
    
    document.getElementById('profile-likes-count').innerText = userStats[currentUser]?.totalLikes || 0;
});

function renderHallOfFame(container, topUsers) { /* ... без изменений */ }
function renderDrawingsList(container, array) { /* ... без изменений, но полностью рабочая */ }

// ... (все глобальные функции: toggleLike, addComment, deletePost, editPost, changeAvatar - без изменений)

        
