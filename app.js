// ==========================================
// 1. НАСТРОЙКИ FIREBASE
// ==========================================
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
let currentProfileView = null;
let allDrawings = {};
let allUsers = {};
let editorMode = 'new'; 
let editingDrawingId = null;

const DEFAULT_AVATAR = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
    if(screenId === 'leaderboard-screen') renderLeaderboard();
}

// Авторизация
function initAuth() {
    const savedUser = localStorage.getItem('bitpaint_user');
    if (savedUser) login(savedUser);
    initTextures(); // Инициализируем текстуры при старте
}

document.getElementById('login-btn').addEventListener('click', () => {
    const nick = document.getElementById('nickname-input').value.trim();
    if (nick.length >= 3) login(nick);
    else alert("Никнейм должен быть не менее 3 символов");
});

function login(nickname) {
    currentUser = nickname;
    localStorage.setItem('bitpaint_user', nickname);
    const userRef = db.ref(`users/${nickname}`);
    userRef.once('value', snap => {
        if (!snap.exists()) {
            userRef.set({ joined: firebase.database.ServerValue.TIMESTAMP, avatar: DEFAULT_AVATAR });
        }
        document.getElementById('header-nickname').innerText = nickname;
        userRef.child('avatar').on('value', avatarSnap => {
            document.getElementById('header-avatar').src = avatarSnap.val() || DEFAULT_AVATAR;
        });
        showScreen('main-screen');
        loadData();
    });
}

function loadData() {
    db.ref('users').on('value', snap => { allUsers = snap.val() || {}; if (currentProfileView) renderProfileGrid(); });
    db.ref('drawings').on('value', snap => { allDrawings = snap.val() || {}; renderFeed(); if (currentProfileView) renderProfileGrid(); });
}

// Рендеринг
function updateDrawingsUI(containerId, sortedIds) {
    const container = document.getElementById(containerId);
    Array.from(container.children).forEach(child => {
        const id = child.id.replace(`card-${containerId}-`, '');
        if (!sortedIds.includes(id)) child.remove();
    });
    sortedIds.forEach((id, index) => {
        let card = document.getElementById(`card-${containerId}-${id}`);
        if (!card) {
            card = createDrawingCard(id, allDrawings[id], containerId);
            card.id = `card-${containerId}-${id}`;
            card.classList.add('post-enter-anim');
            if (index >= container.children.length) container.appendChild(card);
            else container.insertBefore(card, container.children[index]);
        } else {
            updateDrawingCard(card, id, allDrawings[id]);
        }
    });
}

function renderFeed() {
    const sortedIds = Object.keys(allDrawings).sort((a, b) => allDrawings[b].timestamp - allDrawings[a].timestamp);
    updateDrawingsUI('feed', sortedIds);
}

function renderProfileGrid() {
    let totalLikes = 0, drawingsCount = 0;
    const sortedIds = Object.keys(allDrawings).sort((a, b) => allDrawings[b].timestamp - allDrawings[a].timestamp).filter(id => {
            if (allDrawings[id].author === currentProfileView) {
                drawingsCount++;
                totalLikes += allDrawings[id].likes ? Object.keys(allDrawings[id].likes).length : 0;
                return true;
            }
            return false;
        });
    document.getElementById('stat-likes').innerText = totalLikes;
    document.getElementById('stat-drawings').innerText = drawingsCount;
    updateDrawingsUI('profile-grid', sortedIds);
}

function showProfile(nickname) {
    currentProfileView = nickname;
    document.getElementById('profile-nickname').innerText = nickname;
    document.getElementById('profile-avatar').src = allUsers[nickname] ? allUsers[nickname].avatar : DEFAULT_AVATAR;
    document.getElementById('edit-avatar-btn').style.display = (nickname === currentUser) ? 'flex' : 'none';
    renderProfileGrid(); showScreen('profile-screen');
}

function createDrawingCard(id, data) {
    const card = document.createElement('div'); card.className = 'drawing-card neon-card';
    const likesCount = data.likes ? Object.keys(data.likes).length : 0;
    const isLiked = data.likes && data.likes[currentUser];
    const isAuthor = data.author === currentUser;
    let innerCommentsHtml = '';
    if (data.comments) {
        Object.keys(data.comments).sort((a,b) => data.comments[a].timestamp - data.comments[b].timestamp)
        .forEach(cId => { innerCommentsHtml += `<div class="comment"><b>${data.comments[cId].author}:</b> ${data.comments[cId].text}</div>`; });
    }
    card.innerHTML = `
        <div class="drawing-header">
            <span class="drawing-title">${data.title}</span>
            <div style="display:flex; gap: 10px;">
                ${isAuthor ? `<i class="fa-solid fa-pencil edit-post-btn" onclick="openEditor('edit', '${id}')" title="Редактировать"></i>` : ''}
                ${isAuthor ? `<i class="fa-solid fa-trash edit-post-btn" style="color:var(--danger);" onclick="deleteDrawing('${id}')" title="Удалить"></i>` : ''}
            </div>
        </div>
        <img src="${data.image}" class="drawing-img" alt="art">
        <div class="drawing-info">
            <div class="drawing-actions">
                <i class="fa-solid fa-heart like-btn ${isLiked ? 'liked' : ''}" onclick="toggleLike('${id}')"></i> <span class="like-count">${likesCount}</span>
                <span class="author-link" onclick="showProfile('${data.author}')">@${data.author}</span>
            </div>
            <div class="comments-section">${innerCommentsHtml}</div>
            <div class="comment-form">
                <input type="text" class="comment-input" placeholder="Комментарий..." onkeypress="handleComment(event, this, '${id}')">
                <button class="neon-btn btn-sm" onclick="sendComment(this, '${id}')"><i class="fa-solid fa-paper-plane"></i></button>
            </div>
        </div>`;
    return card;
}

function updateDrawingCard(card, id, data) {
    const likesCount = data.likes ? Object.keys(data.likes).length : 0;
    const isLiked = data.likes && data.likes[currentUser];
    const likeBtn = card.querySelector('.like-btn');
    card.querySelector('.like-count').innerText = likesCount;
    if (isLiked) {
        if (!likeBtn.classList.contains('liked')) {
            likeBtn.classList.add('liked'); likeBtn.classList.remove('like-anim'); void likeBtn.offsetWidth; likeBtn.classList.add('like-anim');
        }
    } else { likeBtn.classList.remove('liked', 'like-anim'); }
    if (card.querySelector('.drawing-img').src !== data.image) card.querySelector('.drawing-img').src = data.image;
    
    const commentsContainer = card.querySelector('.comments-section');
    let innerCommentsHtml = '';
    if (data.comments) {
        Object.keys(data.comments).sort((a,b) => data.comments[a].timestamp - data.comments[b].timestamp)
        .forEach(cId => { innerCommentsHtml += `<div class="comment"><b>${data.comments[cId].author}:</b> ${data.comments[cId].text}</div>`; });
    }
    if (commentsContainer.innerHTML !== innerCommentsHtml) {
        commentsContainer.innerHTML = innerCommentsHtml; commentsContainer.scrollTop = commentsContainer.scrollHeight;
    }
}

function deleteDrawing(id) { if (confirm("Навсегда удалить этот рисунок?")) db.ref(`drawings/${id}`).remove(); }
function toggleLike(id) {
    const ref = db.ref(`drawings/${id}/likes/${currentUser}`);
    ref.once('value', snap => { if (snap.exists()) ref.remove(); else ref.set(true); });
}
function handleComment(e, inputElement, id) { if (e.key === 'Enter') executeComment(inputElement, id); }
function sendComment(btnElement, id) { executeComment(btnElement.previousElementSibling, id); }
function executeComment(inputElement, id) {
    const text = inputElement.value.trim(); if (!text) return;
    db.ref(`drawings/${id}/comments`).push({ author: currentUser, text: text, timestamp: firebase.database.ServerValue.TIMESTAMP });
    inputElement.value = '';
}

function renderLeaderboard() {
    const list = document.getElementById('leaderboard-list'); list.innerHTML = '';
    const userLikes = {};
    Object.values(allDrawings).forEach(d => {
        if (!userLikes[d.author]) userLikes[d.author] = 0;
        if (d.likes) userLikes[d.author] += Object.keys(d.likes).length;
    });
    Object.keys(userLikes).sort((a, b) => userLikes[b] - userLikes[a]).slice(0, 10).forEach((user, index) => {
        const item = document.createElement('div'); item.className = `lb-item neon-card rank-${index + 1}`; item.onclick = () => showProfile(user);
        item.innerHTML = `<div class="lb-rank">#${index + 1}</div><div class="lb-user"><img src="${allUsers[user] ? allUsers[user].avatar : DEFAULT_AVATAR}"><span class="neon-text">${user}</span></div><div class="lb-likes"><i class="fa-solid fa-heart"></i> ${userLikes[user]}</div>`;
        list.appendChild(item);
    });
}

// ==========================================
// ГЕНЕРАЦИЯ ТЕКСТУР ДЛЯ ФИГУР
// ==========================================
const textures = {};
function initTextures() {
    // Кирпич (Brick)
    const bc = document.createElement('canvas'); bc.width = 40; bc.height = 40; const bctx = bc.getContext('2d');
    bctx.fillStyle = '#b22222'; bctx.fillRect(0,0,40,40); bctx.strokeStyle = '#dddddd'; bctx.lineWidth = 2;
    bctx.beginPath(); bctx.moveTo(0, 20); bctx.lineTo(40, 20); bctx.moveTo(0, 40); bctx.lineTo(40, 40);
    bctx.moveTo(20, 0); bctx.lineTo(20, 20); bctx.moveTo(0, 20); bctx.lineTo(0, 40); bctx.stroke();
    textures.brick = bc;

    // Дерево (Wood)
    const wc = document.createElement('canvas'); wc.width = 40; wc.height = 40; const wctx = wc.getContext('2d');
    wctx.fillStyle = '#8b4513'; wctx.fillRect(0,0,40,40); wctx.strokeStyle = '#5c3317'; wctx.lineWidth = 2;
    wctx.beginPath(); wctx.moveTo(0, 10); wctx.bezierCurveTo(10, 5, 30, 15, 40, 10);
    wctx.moveTo(0, 30); wctx.bezierCurveTo(10, 35, 30, 25, 40, 30); wctx.stroke();
    textures.wood = wc;

    // Камень (Stone)
    const sc = document.createElement('canvas'); sc.width = 40; sc.height = 40; const sctx = sc.getContext('2d');
    sctx.fillStyle = '#808080'; sctx.fillRect(0,0,40,40); sctx.strokeStyle = '#505050'; sctx.lineWidth = 1;
    sctx.beginPath(); sctx.moveTo(10,10); sctx.lineTo(20,30); sctx.lineTo(30,15); sctx.stroke();
    sctx.fillStyle = '#404040'; sctx.beginPath(); sctx.arc(8, 25, 2, 0, Math.PI*2); sctx.fill();
    sctx.beginPath(); sctx.arc(30, 30, 1.5, 0, Math.PI*2); sctx.fill();
    textures.stone = sc;
}

// ==========================================
// CANVAS EDITOR
// ==========================================
const canvas = document.getElementById('paint-canvas');
const ctx = canvas.getContext('2d', { willReadFrequently: true });
let isDrawing = false, currentTool = 'pencil', startX, startY, snapshot, history = [];

function fillCanvasWhite() { ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, canvas.width, canvas.height); }

function openEditor(mode, id = null) {
    editorMode = mode; editingDrawingId = id; showScreen('editor-screen');
    canvas.width = mode === 'avatar' ? 400 : Math.min(window.innerWidth - 40, 800);
    canvas.height = mode === 'avatar' ? 400 : Math.min(window.innerHeight - 150, 600);
    fillCanvasWhite(); history = [canvas.toDataURL()]; 

    if (mode === 'edit' && id && allDrawings[id]) {
        const img = new Image(); img.crossOrigin = "Anonymous";
        img.onload = () => { ctx.drawImage(img, 0, 0, canvas.width, canvas.height); saveState(); };
        img.src = allDrawings[id].image;
    }
}

window.addEventListener('resize', () => { 
    if(document.getElementById('editor-screen').classList.contains('active')) {
        const imgData = canvas.toDataURL(); 
        canvas.width = Math.min(window.innerWidth - 40, 800); canvas.height = Math.min(window.innerHeight - 150, 600);
        fillCanvasWhite();
        const img = new Image(); img.onload = () => ctx.drawImage(img, 0, 0); img.src = imgData;
    }
});

function closeEditor() { showScreen('main-screen'); }

document.querySelectorAll('.tool-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelector('.tool-btn.active').classList.remove('active');
        btn.classList.add('active'); currentTool = btn.dataset.tool;
    });
});

function getSettings() {
    return { 
        color: document.getElementById('color-picker').value, 
        size: document.getElementById('size-slider').value, 
        neon: document.getElementById('neon-mode').checked 
    };
}

function applySettings() {
    const s = getSettings();
    ctx.lineWidth = s.size; ctx.lineCap = "round"; ctx.lineJoin = "round";
    if (currentTool === 'eraser') {
        ctx.strokeStyle = "#ffffff"; ctx.shadowBlur = 0; ctx.shadowColor = "transparent";
    } else {
        ctx.strokeStyle = s.color; ctx.fillStyle = s.color;
        if (s.neon && currentTool !== 'picker') { 
            ctx.shadowBlur = parseInt(s.size) + 10; ctx.shadowColor = s.color; 
        } else { ctx.shadowBlur = 0; ctx.shadowColor = "transparent"; }
    }
}

function saveState() { history.push(canvas.toDataURL()); if (history.length > 15) history.shift(); }
function undo() {
    if (history.length > 1) {
        history.pop();
        const img = new Image();
        img.onload = () => { ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.drawImage(img, 0, 0); };
        img.src = history[history.length - 1];
    } else if (history.length === 1) { fillCanvasWhite(); }
}
document.addEventListener('keydown', (e) => { if (e.ctrlKey && e.key === 'z') undo(); });

function getPos(e) {
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: clientX - rect.left, y: clientY - rect.top };
}

// Конвертер цвета для Пипетки
function rgbToHex(r, g, b) {
    return "#" + (1 << 24 | r << 16 | g << 8 | b).toString(16).slice(1);
}

const startDraw = (e) => {
    if(e.touches) e.preventDefault();
    const pos = getPos(e); startX = pos.x; startY = pos.y;
    
    // ЛОГИКА ПИПЕТКИ
    if (currentTool === 'picker') {
        const px = ctx.getImageData(Math.floor(startX), Math.floor(startY), 1, 1).data;
        const hexColor = rgbToHex(px[0], px[1], px[2]);
        document.getElementById('color-picker').value = hexColor;
        
        // Возвращаем на карандаш после выбора
        document.querySelector('.tool-btn.active').classList.remove('active');
        document.querySelector('[data-tool="pencil"]').classList.add('active');
        currentTool = 'pencil';
        return;
    }

    isDrawing = true; applySettings(); 
    
    if (currentTool === 'fill') {
        floodFill(Math.floor(startX), Math.floor(startY), getSettings().color);
        saveState(); isDrawing = false; return;
    }
    ctx.beginPath(); ctx.moveTo(startX, startY);
    snapshot = ctx.getImageData(0, 0, canvas.width, canvas.height);
};

const drawing = (e) => {
    if (!isDrawing || currentTool === 'picker') return;
    if(e.touches) e.preventDefault();
    const pos = getPos(e);
    
    const doShapeFill = document.getElementById('shape-fill').checked;
    const textureType = document.getElementById('texture-select').value;

    if (['line', 'rect', 'circle'].includes(currentTool)) {
        ctx.putImageData(snapshot, 0, 0);
        ctx.beginPath(); applySettings(); 
        
        if (currentTool === 'circle') {
            const radius = Math.sqrt(Math.pow(pos.x - startX, 2) + Math.pow(pos.y - startY, 2));
            ctx.moveTo(startX + radius, startY);
        } else { ctx.moveTo(startX, startY); }
    }

    if (currentTool === 'pencil' || currentTool === 'eraser' || currentTool === 'line') {
        ctx.lineTo(pos.x, pos.y); ctx.stroke();
    } else if (currentTool === 'rect') {
        const width = pos.x - startX, height = pos.y - startY;
        if (doShapeFill) {
            if (textureType !== 'none') { ctx.fillStyle = ctx.createPattern(textures[textureType], 'repeat'); }
            ctx.fillRect(startX, startY, width, height);
        }
        ctx.strokeRect(startX, startY, width, height);
    } else if (currentTool === 'circle') {
        const radius = Math.sqrt(Math.pow(pos.x - startX, 2) + Math.pow(pos.y - startY, 2));
        ctx.arc(startX, startY, radius, 0, 2 * Math.PI); 
        if (doShapeFill) {
            if (textureType !== 'none') { ctx.fillStyle = ctx.createPattern(textures[textureType], 'repeat'); }
            ctx.fill();
        }
        ctx.stroke();
    }
};

const stopDraw = (e) => {
    if (!isDrawing) return;
    isDrawing = false; ctx.closePath(); saveState();
};

canvas.addEventListener('mousedown', startDraw); canvas.addEventListener('mousemove', drawing);
canvas.addEventListener('mouseup', stopDraw); canvas.addEventListener('mouseout', stopDraw);
canvas.addEventListener('touchstart', startDraw, {passive: false}); canvas.addEventListener('touchmove', drawing, {passive: false}); canvas.addEventListener('touchend', stopDraw);

// Flood Fill (ЗАЛИВКА ХОЛСТА)
function hexToRgba(hex) {
    const r = parseInt(hex.slice(1, 3), 16); const g = parseInt(hex.slice(3, 5), 16); const b = parseInt(hex.slice(5, 7), 16);
    return [r, g, b, 255];
}
function matchColor(data, pos, targetColor, tolerance = 30) {
    const r = data[pos], g = data[pos+1], b = data[pos+2], a = data[pos+3];
    return Math.abs(r - targetColor[0]) <= tolerance && Math.abs(g - targetColor[1]) <= tolerance && Math.abs(b - targetColor[2]) <= tolerance && Math.abs(a - targetColor[3]) <= tolerance;
}
function floodFill(startX, startY, fillColorHex) {
    const w = canvas.width, h = canvas.height;
    const imgData = ctx.getImageData(0, 0, w, h); const data = imgData.data;
    const fillRgba = hexToRgba(fillColorHex);
    const startPos = (startY * w + startX) * 4;
    const targetRgba = [data[startPos], data[startPos+1], data[startPos+2], data[startPos+3]];

    if (matchColor(fillRgba, 0, targetRgba, 0)) return;

    const stack = [startX, startY];
    while(stack.length) {
        const y = stack.pop(), x = stack.pop();
        let pos = (y * w + x) * 4, currY = y;
        while(currY >= 0 && matchColor(data, pos, targetRgba)) { currY--; pos -= w * 4; }
        currY++; pos += w * 4;
        let reachLeft = false, reachRight = false;
        while(currY < h && matchColor(data, pos, targetRgba)) {
            data[pos] = fillRgba[0]; data[pos+1] = fillRgba[1]; data[pos+2] = fillRgba[2]; data[pos+3] = 255;
            if (x > 0) {
                if (matchColor(data, pos - 4, targetRgba)) { if (!reachLeft) { stack.push(x - 1, currY); reachLeft = true; } }
                else if (reachLeft) reachLeft = false;
            }
            if (x < w - 1) {
                if (matchColor(data, pos + 4, targetRgba)) { if (!reachRight) { stack.push(x + 1, currY); reachRight = true; } }
                else if (reachRight) reachRight = false;
            }
            currY++; pos += w * 4;
        }
    }
    ctx.putImageData(imgData, 0, 0);
}

function saveDrawing() {
    const dataURL = canvas.toDataURL('image/png'); 
    if (editorMode === 'avatar') {
        db.ref(`users/${currentUser}`).update({ avatar: dataURL }); alert('Аватар обновлен!'); closeEditor()
