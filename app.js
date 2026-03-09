// Твоя конфигурация Firebase
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

// Инициализация Firebase (Compat версия для работы без локального сервера)
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// Глобальные переменные
let currentUser = null;
let currentDrawingId = null; // Для редактирования

// --- Навигация и Авторизация ---
const screens = ['auth-screen', 'main-screen', 'draw-screen', 'hall-screen', 'profile-screen'];
function showScreen(screenId) {
    screens.forEach(s => document.getElementById(s).classList.add('hidden'));
    document.getElementById(screenId).classList.remove('hidden');
    if(screenId === 'draw-screen') resizeCanvas();
}

document.getElementById('login-btn').addEventListener('click', () => {
    const nick = document.getElementById('nickname-input').value.trim();
    if (nick) {
        currentUser = nick;
        localStorage.setItem('bitpaint_user', nick);
        document.getElementById('user-name-display').innerText = nick;
        // Регистрируем юзера в БД если нет
        db.ref('users/' + nick).update({ lastLogin: Date.now() });
        showScreen('main-screen');
    }
});

// Проверка сессии при старте
window.onload = () => {
    const savedUser = localStorage.getItem('bitpaint_user');
    if (savedUser) {
        currentUser = savedUser;
        document.getElementById('user-name-display').innerText = savedUser;
        showScreen('main-screen');
    }
    initCanvas();
};

document.getElementById('nav-draw-btn').addEventListener('click', () => {
    currentDrawingId = null;
    clearCanvas();
    showScreen('draw-screen');
});
document.getElementById('close-draw-btn').addEventListener('click', () => showScreen('main-screen'));
document.getElementById('nav-hall-btn').addEventListener('click', () => showScreen('hall-screen'));
document.getElementById('back-from-hall-btn').addEventListener('click', () => showScreen('main-screen'));
document.getElementById('nav-profile-btn').addEventListener('click', () => {
    document.getElementById('profile-name').innerText = currentUser;
    showScreen('profile-screen');
});
document.getElementById('back-from-profile-btn').addEventListener('click', () => showScreen('main-screen'));

// --- Движок Рисования (Canvas API) ---
const canvas = document.getElementById('paint-canvas');
const ctx = canvas.getContext('2d', { willReadFrequently: true });
let isDrawing = false, startX, startY;
let undoStack = [];
let savedImageData = null;

let state = {
    tool: 'pencil', color: '#8a2be2', width: 5, neon: false, fill: false, texture: 'none'
};

function resizeCanvas() {
    const rect = canvas.parentElement.getBoundingClientRect();
    if(canvas.width !== rect.width || canvas.height !== rect.height) {
        const imgData = undoStack.length > 0 ? ctx.getImageData(0,0, canvas.width, canvas.height) : null;
        canvas.width = rect.width;
        canvas.height = rect.height;
        clearCanvas();
        if(imgData) ctx.putImageData(imgData, 0, 0);
    }
}

function clearCanvas() {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    saveState();
}

function saveState() {
    if (undoStack.length >= 15) undoStack.shift();
    undoStack.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
}

function undo() {
    if (undoStack.length > 1) {
        undoStack.pop();
        ctx.putImageData(undoStack[undoStack.length - 1], 0, 0);
    } else if (undoStack.length === 1) {
        clearCanvas();
    }
}

document.getElementById('undo-btn').addEventListener('click', undo);
document.addEventListener('keydown', (e) => { if(e.ctrlKey && e.key === 'z') undo(); });

// Настройки инструментов
document.querySelectorAll('.tool-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
        state.tool = e.currentTarget.dataset.tool;
    });
});
document.getElementById('color-picker').addEventListener('input', e => state.color = e.target.value);
document.getElementById('line-width').addEventListener('input', e => state.width = e.target.value);
document.getElementById('neon-mode').addEventListener('change', e => state.neon = e.target.checked);
document.getElementById('fill-shapes').addEventListener('change', e => state.fill = e.target.checked);
document.getElementById('texture-select').addEventListener('change', e => state.texture = e.target.value);

// Получение координат (мышь + тач)
function getPos(e) {
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: clientX - rect.left, y: clientY - rect.top };
}

// Генерация текстур
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
    if(state.neon && state.tool !== 'eraser') {
        ctx.shadowBlur = 15;
        ctx.shadowColor = state.color;
    } else {
        ctx.shadowBlur = 0;
        ctx.shadowColor = 'transparent';
    }
}

// События холста
function startDraw(e) {
    e.preventDefault(); // Запрет скролла при рисовании на мобилках
    isDrawing = true;
    const pos = getPos(e);
    startX = pos.x; startY = pos.y;
    
    if (state.tool === 'picker') {
        const pixel = ctx.getImageData(startX, startY, 1, 1).data;
        const hex = "#" + ("000000" + ((pixel[0] << 16) | (pixel[1] << 8) | pixel[2]).toString(16)).slice(-6);
        state.color = hex;
        document.getElementById('color-picker').value = hex;
        document.querySelector('[data-tool="pencil"]').click();
        isDrawing = false;
        return;
    }
    
    if (state.tool === 'fill') {
        floodFill(Math.floor(startX), Math.floor(startY), hexToRgb(state.color));
        isDrawing = false;
        saveState();
        return;
    }
    
    savedImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    ctx.beginPath();
    ctx.moveTo(startX, startY);
}

function draw(e) {
    if (!isDrawing) return;
    e.preventDefault();
    const pos = getPos(e);
    
    // Сбрасываем холст до начального состояния перед отрисовкой фигуры
    if (['line', 'rect', 'circle'].includes(state.tool)) {
        ctx.putImageData(savedImageData, 0, 0);
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
        if(state.fill && state.tool !== 'eraser') { ctx.fillStyle = getFillStyle(); ctx.fill(); }
        ctx.stroke();
    } else if (state.tool === 'circle') {
        ctx.beginPath();
        const radius = Math.sqrt(Math.pow(pos.x - startX, 2) + Math.pow(pos.y - startY, 2));
        ctx.moveTo(startX + radius, startY); // Багфикс лишней линии
        ctx.arc(startX, startY, radius, 0, Math.PI * 2);
        if(state.fill) { ctx.fillStyle = getFillStyle(); ctx.fill(); }
        ctx.stroke();
    }
}

function stopDraw(e) {
    if (!isDrawing) return;
    isDrawing = false;
    ctx.shadowBlur = 0; // Сброс тени
    saveState();
}

canvas.addEventListener('mousedown', startDraw);
canvas.addEventListener('mousemove', draw);
canvas.addEventListener('mouseup', stopDraw);
canvas.addEventListener('mouseout', stopDraw);
// Тач-события
canvas.addEventListener('touchstart', startDraw, {passive: false});
canvas.addEventListener('touchmove', draw, {passive: false});
canvas.addEventListener('touchend', stopDraw);

function initCanvas() { clearCanvas(); }

// --- Умная заливка (Flood Fill) ---
function hexToRgb(hex) {
    const bigint = parseInt(hex.slice(1), 16);
    return [bigint >> 16 & 255, bigint >> 8 & 255, bigint & 255, 255];
}

function floodFill(x, y, fillColor) {
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imgData.data;
    const w = canvas.width, h = canvas.height;
    const stack = [[x, y]];
    const startIdx = (y * w + x) * 4;
    const startR = data[startIdx], startG = data[startIdx+1], startB = data[startIdx+2], startA = data[startIdx+3];
    
    if (Math.abs(startR - fillColor[0]) < 10 && Math.abs(startG - fillColor[1]) < 10 && Math.abs(startB - fillColor[2]) < 10) return;

    const tolerance = 50; 
    function matchStartColor(idx) {
        return Math.abs(data[idx] - startR) <= tolerance &&
               Math.abs(data[idx+1] - startG) <= tolerance &&
               Math.abs(data[idx+2] - startB) <= tolerance &&
               Math.abs(data[idx+3] - startA) <= tolerance;
    }

    while(stack.length) {
        const [cx, cy] = stack.pop();
        let idx = (cy * w + cx) * 4;
        
        while(cy >= 0 && matchStartColor(idx)) { cy--; idx -= w * 4; }
        idx += w * 4; cy++;
        
        let reachLeft = false, reachRight = false;
        while(cy++ < h && matchStartColor(idx)) {
            data[idx] = fillColor[0]; data[idx+1] = fillColor[1]; data[idx+2] = fillColor[2]; data[idx+3] = 255;
            
            if (cx > 0) {
                if (matchStartColor(idx - 4)) { if (!reachLeft) { stack.push([cx - 1, cy]); reachLeft = true; } }
                else if (reachLeft) { reachLeft = false; }
            }
            if (cx < w - 1) {
                if (matchStartColor(idx + 4)) { if (!reachRight) { stack.push([cx + 1, cy]); reachRight = true; } }
                else if (reachRight) { reachRight = false; }
            }
            idx += w * 4;
        }
    }
    ctx.putImageData(imgData, 0, 0);
}

// --- Интеграция Firebase (Синхронизация) ---

// Публикация/Обновление
document.getElementById('save-draw-btn').addEventListener('click', () => {
    const dataURL = canvas.toDataURL('image/png');
    if (currentDrawingId) {
        db.ref('drawings/' + currentDrawingId).update({ image: dataURL })
          .then(() => showScreen('main-screen'));
    } else {
        const title = prompt("Введите название рисунка:") || "Без названия";
        db.ref('drawings').push({
            author: currentUser,
            title: title,
            image: dataURL,
            timestamp: firebase.database.ServerValue.TIMESTAMP,
            likes: {}, comments: {}
        }).then(() => showScreen('main-screen'));
    }
});

// Умный рендеринг ленты
db.ref('drawings').on('value', snapshot => {
    const data = snapshot.val() || {};
    const feed = document.getElementById('feed-container');
    const hall = document.getElementById('hall-container');
    const profileFeed = document.getElementById('profile-feed-container');
    
    const drawingsArray = Object.entries(data).map(([id, val]) => ({ id, ...val })).sort((a, b) => b.timestamp - a.timestamp);
    
    const sortedByLikes = [...drawingsArray].sort((a, b) => Object.keys(b.likes || {}).length - Object.keys(a.likes || {}).length).slice(0, 10);
    renderList(hall, sortedByLikes, true);
    
    renderList(feed, drawingsArray, false);
    renderList(profileFeed, drawingsArray.filter(d => d.author === currentUser), false);
    
    const myTotalLikes = drawingsArray.filter(d => d.author === currentUser)
        .reduce((sum, d) => sum + Object.keys(d.likes || {}).length, 0);
    document.getElementById('profile-likes-count').innerText = myTotalLikes;
});

function renderList(container, array, isHallOfFame) {
    const currentIds = array.map(d => `post-${container.id}-${d.id}`);
    Array.from(container.children).forEach(child => {
        if (!currentIds.includes(child.id)) child.remove();
    });

    array.forEach((drawing, index) => {
        const cardId = `post-${container.id}-${drawing.id}`;
        let card = document.getElementById(cardId);
        const likesCount = Object.keys(drawing.likes || {}).length;
        const isLikedByMe = drawing.likes && drawing.likes[currentUser];

        if (!card) {
            card = document.createElement('div');
            card.id = cardId;
            card.className = `post-card glow-panel ${isHallOfFame ? 'rank-' + (index + 1) : ''}`;
            
            card.innerHTML = `
                <img src="${drawing.image}" class="post-img" alt="Art">
                <div class="post-info">
                    <div class="post-header">
                        <div class="post-title">${isHallOfFame ? '#' + (index+1) + ' ' : ''}${drawing.title}</div>
                        <div class="post-author"><i class="fas fa-user"></i> ${drawing.author}</div>
                    </div>
                    <div class="post-actions">
                        <button class="like-btn ${isLikedByMe ? 'liked' : ''}" onclick="toggleLike('${drawing.id}')">
                            <i class="${isLikedByMe ? 'fas' : 'far'} fa-heart"></i> <span class="like-count">${likesCount}</span>
                        </button>
                        ${!isHallOfFame && drawing.author === currentUser ? `
                            <button class="icon-btn" onclick="editPost('${drawing.id}', '${drawing.image}')" title="Редактировать"><i class="fas fa-pencil-alt"></i></button>
                            <button class="icon-btn danger" onclick="deletePost('${drawing.id}')" title="Удалить"><i class="fas fa-trash"></i></button>
                        ` : ''}
                    </div>
                    ${!isHallOfFame ? `
                    <div class="comments-section" id="comments-${container.id}-${drawing.id}"></div>
                    <div class="comment-input-wrapper">
                        <input type="text" id="comm-input-${container.id}-${drawing.id}" placeholder="Комментарий...">
                        <button onclick="addComment('${drawing.id}', '${container.id}')"><i class="fas fa-paper-plane"></i></button>
                    </div>` : ''}
                </div>
            `;
            container.appendChild(card);
        } else {
            const likeBtn = card.querySelector('.like-btn');
            card.querySelector('.like-count').innerText = likesCount;
            if (isLikedByMe) {
                likeBtn.classList.add('liked');
                likeBtn.querySelector('i').className = 'fas fa-heart';
            } else {
                likeBtn.classList.remove('liked');
                likeBtn.querySelector('i').className = 'far fa-heart';
            }
        }

        if (!isHallOfFame) {
            const commentsBox = card.querySelector('.comments-section');
            if(commentsBox) {
                const commentsHTML = Object.values(drawing.comments || {}).map(c => 
                    `<div class="comment"><span>${c.author}:</span> ${c.text}</div>`
                ).join('');
                if(commentsBox.innerHTML !== commentsHTML) commentsBox.innerHTML = commentsHTML;
            }
        }
    });
}

// Глобальные функции
window.toggleLike = (id) => {
    const ref = db.ref(`drawings/${id}/likes/${currentUser}`);
    ref.once('value').then(snap => {
        if (snap.exists()) ref.remove();
        else ref.set(true);
    });
};

window.addComment = (id, containerId) => {
    const input = document.getElementById(`comm-input-${containerId}-${id}`);
    const text = input.value.trim();
    if(text) {
        db.ref(`drawings/${id}/comments`).push({ author: currentUser, text: text, timestamp: Date.now() });
        input.value = '';
    }
};

window.deletePost = (id) => {
    if(confirm("Точно удалить этот арт?")) db.ref('drawings/' + id).remove();
};

window.editPost = (id, imgData) => {
    currentDrawingId = id;
    const img = new Image();
    img.onload = () => {
        clearCanvas();
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        saveState();
        showScreen('draw-screen');
    };
    img.src = imgData;
};

document.getElementById('change-avatar-btn').addEventListener('click', () => {
    const url = prompt("Введите URL новой аватарки:");
    if(url) {
        document.getElementById('user-avatar').src = url;
        db.ref('users/' + currentUser).update({ avatar: url });
    }
});
        
