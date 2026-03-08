// ==========================================
// 1. НАСТРОЙКИ FIREBASE (Твои ключи добавлены!)
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

// Инициализация Firebase (Compat-версия для работы без сервера)
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// ==========================================
// 2. ГЛОБАЛЬНОЕ СОСТОЯНИЕ
// ==========================================
let currentUser = null;
let currentProfileView = null;
let allDrawings = {};
let allUsers = {};

// Состояния редактора
let editorMode = 'new'; // 'new', 'edit', 'avatar'
let editingDrawingId = null;

// ==========================================
// 3. УПРАВЛЕНИЕ ЭКРАНАМИ
// ==========================================
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
    
    if(screenId === 'leaderboard-screen') renderLeaderboard();
}

// ==========================================
// 4. АВТОРИЗАЦИЯ И ПОЛЬЗОВАТЕЛИ
// ==========================================
const DEFAULT_AVATAR = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

function initAuth() {
    const savedUser = localStorage.getItem('bitpaint_user');
    if (savedUser) {
        login(savedUser);
    }
}

document.getElementById('login-btn').addEventListener('click', () => {
    const nick = document.getElementById('nickname-input').value.trim();
    if (nick.length >= 3) login(nick);
    else alert("Никнейм должен быть не менее 3 символов");
});

function login(nickname) {
    currentUser = nickname;
    localStorage.setItem('bitpaint_user', nickname);
    
    // Проверка/создание в БД
    const userRef = db.ref(`users/${nickname}`);
    userRef.once('value', snap => {
        if (!snap.exists()) {
            userRef.set({
                joined: firebase.database.ServerValue.TIMESTAMP,
                avatar: DEFAULT_AVATAR
            });
        }
        document.getElementById('header-nickname').innerText = nickname;
        // Слушаем изменения аватара текущего юзера
        userRef.child('avatar').on('value', avatarSnap => {
            const ava = avatarSnap.val() || DEFAULT_AVATAR;
            document.getElementById('header-avatar').src = ava;
        });
        showScreen('main-screen');
        loadData();
    });
}

function loadData() {
    // Слушаем всех пользователей для аватарок
    db.ref('users').on('value', snap => {
        allUsers = snap.val() || {};
        if (currentProfileView) renderProfileGrid();
    });

    // Слушаем рисунки
    db.ref('drawings').on('value', snap => {
        allDrawings = snap.val() || {};
        renderFeed();
        if (currentProfileView) renderProfileGrid();
    });
}

// ==========================================
// 5. ЛЕНТА И ПРОФИЛЬ (UI Рендеринг)
// ==========================================
function renderFeed() {
    const feed = document.getElementById('feed');
    feed.innerHTML = '';
    
    // Сортировка: новые сверху
    const sortedIds = Object.keys(allDrawings).sort((a, b) => allDrawings[b].timestamp - allDrawings[a].timestamp);
    
    sortedIds.forEach(id => {
        feed.appendChild(createDrawingCard(id, allDrawings[id]));
    });
}

function showProfile(nickname) {
    currentProfileView = nickname;
    document.getElementById('profile-nickname').innerText = nickname;
    
    const user = allUsers[nickname];
    document.getElementById('profile-avatar').src = user ? user.avatar : DEFAULT_AVATAR;
    
    // Показываем кнопку редактирования аватара только хозяину
    document.getElementById('edit-avatar-btn').style.display = (nickname === currentUser) ? 'flex' : 'none';
    
    renderProfileGrid();
    showScreen('profile-screen');
}

function renderProfileGrid() {
    const grid = document.getElementById('profile-grid');
    grid.innerHTML = '';
    
    let totalLikes = 0;
    let drawingsCount = 0;

    const sortedIds = Object.keys(allDrawings).sort((a, b) => allDrawings[b].timestamp - allDrawings[a].timestamp);
    
    sortedIds.forEach(id => {
        const d = allDrawings[id];
        if (d.author === currentProfileView) {
            drawingsCount++;
            totalLikes += d.likes ? Object.keys(d.likes).length : 0;
            grid.appendChild(createDrawingCard(id, d));
        }
    });

    document.getElementById('stat-likes').innerText = totalLikes;
    document.getElementById('stat-drawings').innerText = drawingsCount;
}

function createDrawingCard(id, data) {
    const card = document.createElement('div');
    card.className = 'drawing-card neon-card';
    
    const likesCount = data.likes ? Object.keys(data.likes).length : 0;
    const isLiked = data.likes && data.likes[currentUser];
    
    const isAuthor = data.author === currentUser;
    
    // Блок комментариев
    let commentsHtml = '<div class="comments-section" id="comments-'+id+'">';
    if (data.comments) {
        const cIds = Object.keys(data.comments).sort((a,b) => data.comments[a].timestamp - data.comments[b].timestamp);
        cIds.forEach(cId => {
            const c = data.comments[cId];
            commentsHtml += `<div class="comment"><b>${c.author}:</b> ${c.text}</div>`;
        });
    }
    commentsHtml += '</div>';

    card.innerHTML = `
        <div class="drawing-header">
            <span class="drawing-title">${data.title}</span>
            ${isAuthor ? `<i class="fa-solid fa-pencil edit-post-btn" onclick="openEditor('edit', '${id}')" title="Редактировать"></i>` : ''}
        </div>
        <img src="${data.image}" class="drawing-img" alt="art">
        <div class="drawing-info">
            <div class="drawing-actions">
                <i class="fa-solid fa-heart like-btn ${isLiked ? 'liked' : ''}" onclick="toggleLike('${id}')"></i> <span id="like-count-${id}">${likesCount}</span>
                <span class="author-link" onclick="showProfile('${data.author}')">@${data.author}</span>
            </div>
            ${commentsHtml}
            <div class="comment-form">
                <input type="text" id="comment-input-${id}" placeholder="Комментарий..." onkeypress="handleComment(event, '${id}')">
                <button class="neon-btn btn-sm" onclick="sendComment('${id}')"><i class="fa-solid fa-paper-plane"></i></button>
            </div>
        </div>
    `;
    return card;
}

// ==========================================
// 6. ЛАЙКИ И КОММЕНТАРИИ
// ==========================================
function toggleLike(id) {
    const ref = db.ref(`drawings/${id}/likes/${currentUser}`);
    ref.once('value', snap => {
        if (snap.exists()) ref.remove(); // Убрать лайк
        else ref.set(true); // Поставить лайк
    });
}

function handleComment(e, id) {
    if (e.key === 'Enter') sendComment(id);
}

function sendComment(id) {
    const input = document.getElementById(`comment-input-${id}`);
    const text = input.value.trim();
    if (!text) return;

    db.ref(`drawings/${id}/comments`).push({
        author: currentUser,
        text: text,
        timestamp: firebase.database.ServerValue.TIMESTAMP
    });
    input.value = '';
}

// ==========================================
// 7. ЗАЛ СЛАВЫ (Leaderboard)
// ==========================================
function renderLeaderboard() {
    const list = document.getElementById('leaderboard-list');
    list.innerHTML = '';

    // Подсчет лайков
    const userLikes = {};
    Object.values(allDrawings).forEach(d => {
        if (!userLikes[d.author]) userLikes[d.author] = 0;
        if (d.likes) userLikes[d.author] += Object.keys(d.likes).length;
    });

    // Сортировка
    const sortedUsers = Object.keys(userLikes).sort((a, b) => userLikes[b] - userLikes[a]).slice(0, 10);

    sortedUsers.forEach((user, index) => {
        const item = document.createElement('div');
        item.className = `lb-item neon-card rank-${index + 1}`;
        item.onclick = () => showProfile(user);
        
        const avatar = allUsers[user] ? allUsers[user].avatar : DEFAULT_AVATAR;

        item.innerHTML = `
            <div class="lb-rank">#${index + 1}</div>
            <div class="lb-user">
                <img src="${avatar}">
                <span class="neon-text">${user}</span>
            </div>
            <div class="lb-likes"><i class="fa-solid fa-heart"></i> ${userLikes[user]}</div>
        `;
        list.appendChild(item);
    });
}

// ==========================================
// 8. CANVAS EDITOR (САМОЕ СЛОЖНОЕ)
// ==========================================
const canvas = document.getElementById('paint-canvas');
const ctx = canvas.getContext('2d', { willReadFrequently: true });

let isDrawing = false;
let currentTool = 'pencil';
let startX, startY;
let snapshot; // Снимок холста для фигур
let history = []; // Массив для Undo

// Инициализация размеров Canvas
function resizeCanvas(width = window.innerWidth - 40, height = window.innerHeight - 150) {
    const imgData = canvas.toDataURL();
    canvas.width = Math.min(width, 800);
    canvas.height = Math.min(height, 600);
    
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    if (imgData && history.length > 0) {
        const img = new Image();
        img.onload = () => ctx.drawImage(img, 0, 0);
        img.src = imgData;
    }
}
window.addEventListener('resize', () => { if(document.getElementById('editor-screen').classList.contains('active')) resizeCanvas(); });

// Открытие редактора
function openEditor(mode, id = null) {
    editorMode = mode;
    editingDrawingId = id;
    showScreen('editor-screen');
    resizeCanvas(mode === 'avatar' ? 400 : window.innerWidth, mode === 'avatar' ? 400 : window.innerHeight);
    
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    history = [canvas.toDataURL()];

    if (mode === 'edit' && id && allDrawings[id]) {
        const img = new Image();
        img.crossOrigin = "Anonymous";
        img.onload = () => {
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            saveState();
        };
        img.src = allDrawings[id].image;
    }
}

function closeEditor() {
    showScreen('main-screen');
}

// Выбор инструментов
document.querySelectorAll('.tool-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelector('.tool-btn.active').classList.remove('active');
        btn.classList.add('active');
        currentTool = btn.dataset.tool;
    });
});

// Настройки кисти
function getSettings() {
    return {
        color: document.getElementById('color-picker').value,
        size: document.getElementById('size-slider').value,
        neon: document.getElementById('neon-mode').checked
    };
}

function applySettings() {
    const s = getSettings();
    ctx.lineWidth = s.size;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    
    if (currentTool === 'eraser') {
        ctx.strokeStyle = "#000000"; // Ластик рисует фоном
        ctx.shadowBlur = 0;
    } else {
        ctx.strokeStyle = s.color;
        ctx.fillStyle = s.color;
        if (s.neon) {
            ctx.shadowBlur = 15;
            ctx.shadowColor = s.color;
        } else {
            ctx.shadowBlur = 0;
        }
    }
}

// История (Undo)
function saveState() {
    history.push(canvas.toDataURL());
    if (history.length > 15) history.shift();
}
function undo() {
    if (history.length > 1) {
        history.pop();
        const img = new Image();
        img.onload = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0);
        };
        img.src = history[history.length - 1];
    } else if (history.length === 1) {
        ctx.fillStyle = "#000000";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
}
document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'z') undo();
});

// Получение координат
function getPos(e) {
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
        x: clientX - rect.left,
        y: clientY - rect.top
    };
}

// События рисования
const startDraw = (e) => {
    if(e.touches) e.preventDefault();
    isDrawing = true;
    const pos = getPos(e);
    startX = pos.x;
    startY = pos.y;
    
    applySettings();
    
    if (currentTool === 'fill') {
        floodFill(Math.floor(startX), Math.floor(startY), getSettings().color);
        saveState();
        isDrawing = false;
        return;
    }

    ctx.beginPath();
    ctx.moveTo(startX, startY);
    snapshot = ctx.getImageData(0, 0, canvas.width, canvas.height);
};

const drawing = (e) => {
    if (!isDrawing) return;
    if(e.touches) e.preventDefault();
    const pos = getPos(e);

    if (['line', 'rect', 'circle'].includes(currentTool)) {
        ctx.putImageData(snapshot, 0, 0);
        ctx.beginPath();
        applySettings(); 
        ctx.moveTo(startX, startY);
    }

    if (currentTool === 'pencil' || currentTool === 'eraser') {
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
    } else if (currentTool === 'line') {
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
    } else if (currentTool === 'rect') {
        ctx.strokeRect(startX, startY, pos.x - startX, pos.y - startY);
    } else if (currentTool === 'circle') {
        const radius = Math.sqrt(Math.pow(pos.x - startX, 2) + Math.pow(pos.y - startY, 2));
        ctx.arc(startX, startY, radius, 0, 2 * Math.PI);
        ctx.stroke();
    }
};

const stopDraw = (e) => {
    if (!isDrawing) return;
    isDrawing = false;
    ctx.closePath();
    saveState();
};

canvas.addEventListener('mousedown', startDraw);
canvas.addEventListener('mousemove', drawing);
canvas.addEventListener('mouseup', stopDraw);
canvas.addEventListener('mouseout', stopDraw);

canvas.addEventListener('touchstart', startDraw, {passive: false});
canvas.addEventListener('touchmove', drawing, {passive: false});
canvas.addEventListener('touchend', stopDraw);

// ==========================================
// 9. АЛГОРИТМ SMART FILL (Flood Fill)
// ==========================================
function hexToRgba(hex) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return [r, g, b, 255];
}

function matchColor(data, pos, targetColor, tolerance = 30) {
    const r = data[pos], g = data[pos+1], b = data[pos+2], a = data[pos+3];
    return Math.abs(r - targetColor[0]) <= tolerance &&
           Math.abs(g - targetColor[1]) <= tolerance &&
           Math.abs(b - targetColor[2]) <= tolerance &&
           Math.abs(a - targetColor[3]) <= tolerance;
}

function floodFill(startX, startY, fillColorHex) {
    const w = canvas.width, h = canvas.height;
    const imgData = ctx.getImageData(0, 0, w, h);
    const data = imgData.data;
    const fillRgba = hexToRgba(fillColorHex);
    
    const startPos = (startY * w + startX) * 4;
    const targetRgba = [data[startPos], data[startPos+1], data[startPos+2], data[startPos+3]];

    if (matchColor(fillRgba, 0, targetRgba, 0)) return;

    const stack = [startX, startY];
    
    while(stack.length) {
        const y = stack.pop();
        const x = stack.pop();
        
        let pos = (y * w + x) * 4;
        
        let currY = y;
        while(currY >= 0 && matchColor(data, pos, targetRgba)) {
            currY--;
            pos -= w * 4;
        }
        
        currY++;
        pos += w * 4;
        let reachLeft = false;
        let reachRight = false;
        
        while(currY < h && matchColor(data, pos, targetRgba)) {
            data[pos] = fillRgba[0];
            data[pos+1] = fillRgba[1];
            data[pos+2] = fillRgba[2];
            data[pos+3] = 255;
            
            if (x > 0) {
                if (matchColor(data, pos - 4, targetRgba)) {
                    if (!reachLeft) { stack.push(x - 1, currY); reachLeft = true; }
                } else if (reachLeft) reachLeft = false;
            }
            
            if (x < w - 1) {
                if (matchColor(data, pos + 4, targetRgba)) {
                    if (!reachRight) { stack.push(x + 1, currY); reachRight = true; }
                } else if (reachRight) reachRight = false;
            }
            currY++;
            pos += w * 4;
        }
    }
    
    ctx.putImageData(imgData, 0, 0);
}

// ==========================================
// 10. СОХРАНЕНИЕ / ПУБЛИКАЦИЯ
// ==========================================
function saveDrawing() {
    const dataURL = canvas.toDataURL('image/png');

    if (editorMode === 'avatar') {
        db.ref(`users/${currentUser}`).update({ avatar: dataURL });
        alert('Аватар обновлен!');
        closeEditor();
        return;
    }

    let title = "Без названия";
    if (editorMode === 'new') {
        title = prompt("Введите название рисунка:", "");
        if (title === null) return;
        if (title.trim() === "") title = "Без названия";
        
        db.ref('drawings').push({
            author: currentUser,
            image: dataURL,
            title: title,
            timestamp: firebase.database.ServerValue.TIMESTAMP,
            likes: {},
            comments: {}
        });
        alert('Рисунок опубликован!');
    } else if (editorMode === 'edit') {
        if(!confirm("Сохранить изменения в текущем рисунке?")) return;
        
        db.ref(`drawings/${editingDrawingId}`).update({
            image: dataURL
        });
        alert('Рисунок обновлен!');
    }
    
    closeEditor();
}

// Запуск приложения
initAuth();
    
