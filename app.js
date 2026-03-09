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

firebase.initializeApp(firebaseConfig);
const db = firebase.database();

let currentUser = null;
let currentDrawingId = null; 
let isDrawingAvatar = false; // Режим рисования аватарки
const defaultAvatar = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

// Базы данных в памяти для реал-тайма
let allDrawings = [];
let allUsers = {};

// --- Навигация ---
const screens = ['auth-screen', 'main-screen', 'draw-screen', 'hall-screen', 'profile-screen'];
function showScreen(screenId) {
    screens.forEach(s => document.getElementById(s).classList.add('hidden'));
    document.getElementById(screenId).classList.remove('hidden');
}

document.getElementById('login-btn').addEventListener('click', () => {
    const nick = document.getElementById('nickname-input').value.trim();
    if (nick) {
        currentUser = nick;
        localStorage.setItem('bitpaint_user', nick);
        db.ref('users/' + nick).update({ lastLogin: Date.now() });
        showScreen('main-screen');
    }
});

window.onload = () => {
    const savedUser = localStorage.getItem('bitpaint_user');
    if (savedUser) { currentUser = savedUser; showScreen('main-screen'); }
    clearCanvas(); // Холст жестко 800x600, ресайз не нужен
};

document.getElementById('nav-draw-btn').addEventListener('click', () => {
    currentDrawingId = null; isDrawingAvatar = false;
    document.getElementById('avatar-mask').classList.add('hidden');
    clearCanvas(); showScreen('draw-screen');
});
document.getElementById('change-avatar-btn').addEventListener('click', () => {
    isDrawingAvatar = true;
    document.getElementById('avatar-mask').classList.remove('hidden');
    clearCanvas(); showScreen('draw-screen');
});
document.getElementById('close-draw-btn').addEventListener('click', () => showScreen('main-screen'));
document.getElementById('nav-hall-btn').addEventListener('click', () => showScreen('hall-screen'));
document.getElementById('back-from-hall-btn').addEventListener('click', () => showScreen('main-screen'));
document.getElementById('nav-profile-btn').addEventListener('click', () => showScreen('profile-screen'));
document.getElementById('back-from-profile-btn').addEventListener('click', () => showScreen('main-screen'));


// --- Движок Рисования (Canvas API) ---
const canvas = document.getElementById('paint-canvas');
// Размер строго 800x600 всегда!
const ctx = canvas.getContext('2d', { willReadFrequently: true });
let isDrawing = false, startX, startY;
let undoStack = [];
let savedImageData = null;

let state = { tool: 'pencil', color: '#8a2be2', width: 5, neon: false, fill: false, texture: 'none' };

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
        undoStack.pop(); ctx.putImageData(undoStack[undoStack.length - 1], 0, 0);
    } else if (undoStack.length === 1) clearCanvas();
}
document.getElementById('undo-btn').addEventListener('click', undo);
document.addEventListener('keydown', (e) => { if(e.ctrlKey && e.key === 'z') undo(); });

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

// Умный расчет координат при масштабировании холста через CSS
function getPos(e) {
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    
    // Вычисляем масштаб (внутренний размер / физический на экране)
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    return { 
        x: (clientX - rect.left) * scaleX, 
        y: (clientY - rect.top) * scaleY 
    };
}

function getFillStyle() {
    if (!state.fill) return 'transparent';
    if (state.texture === 'none') return state.color;
    const patCanvas = document.createElement('canvas'); const pCtx = patCanvas.getContext('2d');
    patCanvas.width = 20; patCanvas.height = 20; pCtx.fillStyle = state.color; pCtx.fillRect(0,0,20,20);
    pCtx.strokeStyle = 'rgba(0,0,0,0.3)';
    if (state.texture === 'bricks') { pCtx.strokeRect(0,0,10,10); pCtx.strokeRect(10,10,10,10); } 
    else if (state.texture === 'wood') { pCtx.beginPath(); pCtx.arc(10, 10, 5, 0, Math.PI); pCtx.stroke(); }
    return ctx.createPattern(patCanvas, 'repeat');
}

function applyNeon() {
    if(state.neon && state.tool !== 'eraser') { ctx.shadowBlur = 15; ctx.shadowColor = state.color; } 
    else { ctx.shadowBlur = 0; ctx.shadowColor = 'transparent'; }
}

function startDraw(e) {
    e.preventDefault(); isDrawing = true;
    const pos = getPos(e); startX = pos.x; startY = pos.y;
    
    if (state.tool === 'picker') {
        const pixel = ctx.getImageData(startX, startY, 1, 1).data;
        state.color = "#" + ("000000" + ((pixel[0] << 16) | (pixel[1] << 8) | pixel[2]).toString(16)).slice(-6);
        document.getElementById('color-picker').value = state.color;
        document.querySelector('[data-tool="pencil"]').click();
        isDrawing = false; return;
    }
    
    if (state.tool === 'fill') {
        floodFill(Math.floor(startX), Math.floor(startY), hexToRgb(state.color));
        isDrawing = false; saveState(); return;
    }
    savedImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    ctx.beginPath(); ctx.moveTo(startX, startY);
}

function draw(e) {
    if (!isDrawing) return;
    e.preventDefault(); const pos = getPos(e);
    
    if (['line', 'rect', 'circle'].includes(state.tool)) ctx.putImageData(savedImageData, 0, 0);

    ctx.lineWidth = state.width; ctx.lineCap = 'round';
    ctx.strokeStyle = state.tool === 'eraser' ? '#ffffff' : state.color;
    applyNeon();

    if (state.tool === 'pencil' || state.tool === 'eraser') {
        ctx.lineTo(pos.x, pos.y); ctx.stroke();
    } else if (state.tool === 'line') {
        ctx.beginPath(); ctx.moveTo(startX, startY); ctx.lineTo(pos.x, pos.y); ctx.stroke();
    } else if (state.tool === 'rect') {
        ctx.beginPath(); ctx.rect(startX, startY, pos.x - startX, pos.y - startY);
        if(state.fill && state.tool !== 'eraser') { ctx.fillStyle = getFillStyle(); ctx.fill(); }
        ctx.stroke();
    } else if (state.tool === 'circle') {
        ctx.beginPath();
        const radius = Math.sqrt(Math.pow(pos.x - startX, 2) + Math.pow(pos.y - startY, 2));
        ctx.moveTo(startX + radius, startY); 
        ctx.arc(startX, startY, radius, 0, Math.PI * 2);
        if(state.fill) { ctx.fillStyle = getFillStyle(); ctx.fill(); }
        ctx.stroke();
    }
}

function stopDraw(e) {
    if (!isDrawing) return;
    isDrawing = false; ctx.shadowBlur = 0; saveState();
}

canvas.addEventListener('mousedown', startDraw); canvas.addEventListener('mousemove', draw);
canvas.addEventListener('mouseup', stopDraw); canvas.addEventListener('mouseout', stopDraw);
canvas.addEventListener('touchstart', startDraw, {passive: false});
canvas.addEventListener('touchmove', draw, {passive: false});
canvas.addEventListener('touchend', stopDraw);

// Умная заливка
function hexToRgb(hex) {
    const bigint = parseInt(hex.slice(1), 16);
    return [bigint >> 16 & 255, bigint >> 8 & 255, bigint & 255, 255];
}

function floodFill(x, y, fillColor) {
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imgData.data; const w = canvas.width, h = canvas.height;
    const stack = [[x, y]]; const startIdx = (y * w + x) * 4;
    const startR = data[startIdx], startG = data[startIdx+1], startB = data[startIdx+2], startA = data[startIdx+3];
    
    if (Math.abs(startR - fillColor[0])<10 && Math.abs(startG - fillColor[1])<10 && Math.abs(startB - fillColor[2])<10) return;

    const tolerance = 50; 
    function matchStartColor(idx) {
        return Math.abs(data[idx] - startR) <= tolerance && Math.abs(data[idx+1] - startG) <= tolerance && Math.abs(data[idx+2] - startB) <= tolerance;
    }

    while(stack.length) {
        const [cx, cy] = stack.pop(); let idx = (cy * w + cx) * 4;
        while(cy >= 0 && matchStartColor(idx)) { cy--; idx -= w * 4; }
        idx += w * 4; cy++;
        let reachLeft = false, reachRight = false;
        while(cy++ < h && matchStartColor(idx)) {
            data[idx] = fillColor[0]; data[idx+1] = fillColor[1]; data[idx+2] = fillColor[2]; data[idx+3] = 255;
            if (cx > 0) {
                if (matchStartColor(idx - 4)) { if (!reachLeft) { stack.push([cx - 1, cy]); reachLeft = true; } }
                else if (reachLeft) reachLeft = false;
            }
            if (cx < w - 1) {
                if (matchStartColor(idx + 4)) { if (!reachRight) { stack.push([cx + 1, cy]); reachRight = true; } }
                else if (reachRight) reachRight = false;
            }
            idx += w * 4;
        }
    }
    ctx.putImageData(imgData, 0, 0);
}

// --- Интеграция Firebase и Реал-тайм ---

document.getElementById('save-draw-btn').addEventListener('click', () => {
    if (isDrawingAvatar) {
        // Вырезаем квадрат 600x600 из центра холста 800x600
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = 600; tempCanvas.height = 600;
        tempCanvas.getContext('2d').drawImage(canvas, 100, 0, 600, 600, 0, 0, 600, 600);
        
        db.ref('users/' + currentUser).update({ avatar: tempCanvas.toDataURL('image/png') })
          .then(() => { isDrawingAvatar = false; showScreen('profile-screen'); });
    } else {
        const dataURL = canvas.toDataURL('image/png');
        if (currentDrawingId) {
            db.ref('drawings/' + currentDrawingId).update({ image: dataURL }).then(() => showScreen('main-screen'));
        } else {
            const title = prompt("Название рисунка:") || "Без названия";
            db.ref('drawings').push({ author: currentUser, title: title, image: dataURL, timestamp: Date.now(), likes: {}, comments: {} })
              .then(() => showScreen('main-screen'));
        }
    }
});

// Слушаем пользователей (для аватарок)
db.ref('users').on('value', snap => {
    allUsers = snap.val() || {};
    renderAll(); 
});

// Слушаем рисунки
db.ref('drawings').on('value', snap => {
    const data = snap.val() || {};
    allDrawings = Object.entries(data).map(([id, val]) => ({ id, ...val })).sort((a, b) => b.timestamp - a.timestamp);
    renderAll();
});

function renderAll() {
    if(!currentUser) return;
    
    // Обновляем аватарки в шапке и профиле
    const myAvatar = allUsers[currentUser]?.avatar || defaultAvatar;
    document.getElementById('nav-user-avatar').src = myAvatar;
    document.getElementById('user-name-display').innerText = currentUser;
    document.getElementById('profile-big-avatar').src = myAvatar;
    document.getElementById('profile-name').innerText = currentUser;

    // Рендер Зала Славы (Топ-10 ЛЮДЕЙ)
    const userLikes = {};
    allDrawings.forEach(d => {
        const likes = Object.keys(d.likes || {}).length;
        userLikes[d.author] = (userLikes[d.author] || 0) + likes;
    });
    const topUsers = Object.entries(userLikes).sort((a, b) => b[1] - a[1]).slice(0, 10);
    
    document.getElementById('hall-container').innerHTML = topUsers.map((u, i) => `
        <div class="user-rank-card glow-panel rank-${i+1}">
            <div class="rank-number">#${i+1}</div>
            <img src="${allUsers[u[0]]?.avatar || defaultAvatar}">
            <div class="rank-info">
                <h3>${u[0]}</h3>
                <p><i class="fas fa-heart" style="color:#ff4d4d"></i> ${u[1]} лайков</p>
            </div>
        </div>
    `).join('');

    // Рендер Ленты и Профиля
    renderList(document.getElementById('feed-container'), allDrawings);
    renderList(document.getElementById('profile-feed-container'), allDrawings.filter(d => d.author === currentUser));

    // Общий счетчик лайков в профиле
    document.getElementById('profile-likes-count').innerText = userLikes[currentUser] || 0;
}

function renderList(container, array) {
    const currentIds = array.map(d => `post-${container.id}-${d.id}`);
    Array.from(container.children).forEach(child => { if (!currentIds.includes(child.id)) child.remove(); });

    array.forEach(drawing => {
        const cardId = `post-${container.id}-${drawing.id}`;
        let card = document.getElementById(cardId);
        const likesCount = Object.keys(drawing.likes || {}).length;
        const isLikedByMe = drawing.likes && drawing.likes[currentUser];
        const authorAvatar = allUsers[drawing.author]?.avatar || defaultAvatar;

        if (!card) {
            card = document.createElement('div'); card.id = cardId; card.className = `post-card glow-panel`;
            card.innerHTML = `
                <img src="${drawing.image}" class="post-img" alt="Art">
                <div class="post-info">
                    <div class="post-header">
                        <div class="post-title">${drawing.title}</div>
                        <div class="post-author"><img src="${authorAvatar}"> ${drawing.author}</div>
                    </div>
                    <div class="post-actions">
                        <button class="like-btn ${isLikedByMe ? 'liked' : ''}" onclick="toggleLike('${drawing.id}', '${drawing.author}')">
                            <i class="${isLikedByMe ? 'fas' : 'far'} fa-heart"></i> <span class="like-count">${likesCount}</span>
                        </button>
                        ${drawing.author === currentUser ? `
                            <button class="icon-btn" onclick="editPost('${drawing.id}', '${drawing.image}')" title="Редактировать"><i class="fas fa-pencil-alt"></i></button>
                            <button class="icon-btn danger" onclick="deletePost('${drawing.id}')" title="Удалить"><i class="fas fa-trash"></i></button>
                        ` : ''}
                    </div>
                    <div class="comments-section"></div>
                    <div class="comment-input-wrapper">
                        <input type="text" id="comm-input-${container.id}-${drawing.id}" placeholder="Комментарий...">
                        <button onclick="addComment('${drawing.id}', '${container.id}')"><i class="fas fa-paper-plane"></i></button>
                    </div>
                </div>
            `;
            container.appendChild(card);
        } else {
            // Умное обновление без перерисовки (чтобы не сбрасывался фокус с инпута комментов)
            card.querySelector('.post-author img').src = authorAvatar;
            const likeBtn = card.querySelector('.like-btn');
            card.querySelector('.like-count').innerText = likesCount;При подготовке ответа на вопрос возникла ошибка. Повторите попытку позже.
               
