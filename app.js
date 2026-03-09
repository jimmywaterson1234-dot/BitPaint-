/**
 * BITPAINT APP LOGIC
 */

// 1. КОНФИГУРАЦИЯ FIREBASE
const firebaseConfig = {
    apiKey: "AIzaSyD_tw7n8VErwWwqlJy_gWfATPY1cAUJzZk",
    authDomain: "bitpaint-f7dbd.firebaseapp.com",
    databaseURL: "https://bitpaint-f7dbd-default-rtdb.firebaseio.com",
    projectId: "bitpaint-f7dbd",
    storageBucket: "bitpaint-f7dbd.firebasestorage.app",
    messagingSenderId: "193627137592",
    appId: "1:193627137592:web:4f3835e21c0adf024468cd"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// 2. ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ
let currentUser = null;
let drawingsData = {}; 
let usersData = {};    

const screens = document.querySelectorAll('.screen');
const navBtns = document.querySelectorAll('.nav-btn');
const feedContainer = document.getElementById('feed-container');
const profileGallery = document.getElementById('profile-gallery');
const hallContainer = document.getElementById('hall-container');

// 3. АВТОРИЗАЦИЯ И ПРОФИЛЬ
function initAuth() {
    const savedUser = localStorage.getItem('bitpaint_user');
    if (savedUser) {
        currentUser = savedUser;
        checkAndCreateUserNode();
        updateHeaderProfile();
        switchScreen('main-screen');
    } else {
        switchScreen('auth-screen');
    }

    document.getElementById('auth-btn').addEventListener('click', () => {
        const nick = document.getElementById('auth-nickname').value.trim();
        if (nick.length >= 3) {
            currentUser = nick;
            localStorage.setItem('bitpaint_user', nick);
            checkAndCreateUserNode();
            updateHeaderProfile();
            switchScreen('main-screen');
        } else alert('Никнейм должен быть не короче 3 символов!');
    });

    document.getElementById('change-avatar-btn').addEventListener('click', () => {
        const newUrl = prompt('Введите URL новой аватарки:', usersData[currentUser]?.avatar || '');
        if (newUrl) db.ref('users/' + currentUser).update({ avatar: newUrl });
    });
}

function checkAndCreateUserNode() {
    db.ref('users/' + currentUser).once('value', snapshot => {
        if (!snapshot.exists()) {
            db.ref('users/' + currentUser).set({
                nickname: currentUser,
                avatar: `https://api.dicebear.com/6.x/bottts/svg?seed=${currentUser}`,
                totalLikes: 0
            });
        }
    });
}

function updateHeaderProfile() {
    document.getElementById('app-header').classList.remove('hidden');
    document.getElementById('header-nickname').textContent = currentUser;
    db.ref('users/' + currentUser).on('value', snap => {
        if (snap.val() && snap.val().avatar) {
            document.getElementById('header-avatar').src = snap.val().avatar;
        }
    });
}

// 4. НАВИГАЦИЯ И ПЕРЕХОДЫ В ПРОФИЛИ
function switchScreen(screenId) {
    screens.forEach(s => s.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
    
    navBtns.forEach(btn => btn.classList.remove('active'));
    const activeBtn = document.querySelector(`.nav-btn[data-target="${screenId}"]`);
    if (activeBtn) activeBtn.classList.add('active');

    if (screenId === 'draw-screen') initCanvas();
    if (screenId === 'hall-screen') renderHallOfFame();
    if (screenId === 'profile-screen' && !document.getElementById('profile-nickname').textContent) {
        renderProfile(currentUser);
    }
}

navBtns.forEach(btn => btn.addEventListener('click', e => switchScreen(e.currentTarget.dataset.target)));

window.viewProfile = function(nickname) {
    renderProfile(nickname);
    switchScreen('profile-screen');
};

// 5. ДВИЖОК РИСОВАНИЯ (CANVAS API + POINTER EVENTS + ТЕКСТУРЫ)
const canvas = document.getElementById('paint-canvas');
const ctx = canvas.getContext('2d', { willReadFrequently: true });
let isDrawing = false;
let currentTool = 'pencil';
let startX, startY, snapshot;

// История для отмены
let undoStack = [];

function saveState() {
    if (undoStack.length >= 20) undoStack.shift(); // Храним только 20 шагов
    undoStack.push(canvas.toDataURL());
}

document.getElementById('undo-btn').addEventListener('click', () => {
    if (undoStack.length > 0) {
        let imgData = undoStack.pop();
        let img = new Image();
        img.onload = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0);
        };
        img.src = imgData;
    } else {
        clearCanvasWhite();
    }
});

// Генерация текстур
const textures = {
    wood: createWoodPattern(),
    brick: createBrickPattern()
};

function createWoodPattern() {
    const c = document.createElement('canvas'); c.width = 100; c.height = 100;
    const cx = c.getContext('2d');
    cx.fillStyle = '#8B4513'; cx.fillRect(0,0,100,100);
    cx.strokeStyle = '#5C4033'; cx.lineWidth = 2;
    for(let i=0; i<15; i++) {
        cx.beginPath(); cx.moveTo(0, i*8 + Math.random()*5);
        cx.lineTo(100, i*8 + Math.random()*5); cx.stroke();
    }
    return c;
}

function createBrickPattern() {
    const c = document.createElement('canvas'); c.width = 40; c.height = 40;
    const cx = c.getContext('2d');
    cx.fillStyle = '#B22222'; cx.fillRect(0,0,40,40);
    cx.strokeStyle = '#ecf0f1'; cx.lineWidth = 2;
    cx.beginPath(); cx.moveTo(0,20); cx.lineTo(40,20); cx.stroke();
    cx.beginPath(); cx.moveTo(20,0); cx.lineTo(20,20); cx.stroke();
    cx.beginPath(); cx.moveTo(0,20); cx.lineTo(0,40); cx.stroke();
    cx.beginPath(); cx.moveTo(40,20); cx.lineTo(40,40); cx.stroke();
    return c;
}

function getCoordinates(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
}

function clearCanvasWhite() {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    undoStack = []; 
}

function initCanvas() {
    if (!canvas.getAttribute('data-init')) {
        clearCanvasWhite();
        canvas.setAttribute('data-init', 'true');
    }
}

document.querySelectorAll('.tool-btn').forEach(btn => {
    btn.addEventListener('click', e => {
        document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
        currentTool = e.currentTarget.dataset.tool;
    });
});

document.getElementById('clear-canvas').addEventListener('click', () => {
    saveState();
    clearCanvasWhite();
});

// Обработчик заливки
function hexToRgba(hex) {
    let r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
    return [r, g, b, 255];
}

function floodFill(startX, startY, fillColorHex) {
    startX = Math.round(startX); startY = Math.round(startY);
    const imgData = ctx.getImageData(0,0, canvas.width, canvas.height);
    const data = imgData.data;
    const w = canvas.width; const h = canvas.height;
    
    const startPos = (startY * w + startX) * 4;
    const startR = data[startPos], startG = data[startPos+1], startB = data[startPos+2], startA = data[startPos+3];
    const [fR, fG, fB, fA] = hexToRgba(fillColorHex);
    
    if (startR===fR && startG===fG && startB===fB && startA===fA) return;

    function match(p) { return data[p]===startR && data[p+1]===startG && data[p+2]===startB && data[p+3]===startA; }
    
    const stack = [[startX, startY]];
    while(stack.length) {
        let [x, y] = stack.pop();
        let p = (y * w + x) * 4;
        while(y >= 0 && match(p)) { y--; p -= w * 4; }
        p += w * 4; y++;
        
        let reachL = false, reachR = false;
        while(y < h && match(p)) {
            data[p] = fR; data[p+1] = fG; data[p+2] = fB; data[p+3] = fA;
            if (x > 0) {
                if (match(p - 4)) { if (!reachL) { stack.push([x - 1, y]); reachL = true; } }
                else if (reachL) reachL = false;
            }
            if (x < w - 1) {
                if (match(p + 4)) { if (!reachR) { stack.push([x + 1, y]); reachR = true; } }
                else if (reachR) reachR = false;
            }
            y++; p += w * 4;
        }
    }
    ctx.putImageData(imgData, 0, 0);
}

const startDraw = (e) => {
    isDrawing = true;
    const {x, y} = getCoordinates(e);
    startX = x; startY = y;
    
    saveState(); // Сохраняем перед новым мазком
    snapshot = ctx.getImageData(0, 0, canvas.width, canvas.height);

    const color = document.getElementById('color-picker').value;
    
    if (currentTool === 'bucket') {
        floodFill(x, y, color);
        isDrawing = false;
        return;
    }

    if (currentTool === 'picker') {
        const p = ctx.getImageData(x, y, 1, 1).data;
        document.getElementById('color-picker').value = "#" + ("000000" + ((p[0] << 16) | (p[1] << 8) | p[2]).toString(16)).slice(-6);
        document.querySelector('[data-tool="pencil"]').click();
        isDrawing = false;
        return;
    }

    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineWidth = document.getElementById('brush-size').value;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    
    ctx.strokeStyle = currentTool === 'eraser' ? '#ffffff' : color;

    // Неон эффект
    if (document.getElementById('neon-toggle').checked && currentTool !== 'eraser') {
        ctx.shadowBlur = 15;
        ctx.shadowColor = ctx.strokeStyle;
    } else {
        ctx.shadowBlur = 0;
    }
};

const drawing = (e) => {
    if (!isDrawing) return;
    e.preventDefault();
    const {x, y} = getCoordinates(e);

    if (currentTool === 'pencil' || currentTool === 'eraser') {
        ctx.lineTo(x, y);
        ctx.stroke();
    } else if (currentTool === 'line' || currentTool === 'rect' || currentTool === 'circle') {
        ctx.putImageData(snapshot, 0, 0);
        
        const fillType = document.getElementById('shape-fill').value;
        if (fillType !== 'none') {
            if (fillType === 'solid') ctx.fillStyle = document.getElementById('color-picker').value;
            if (fillType === 'wood') ctx.fillStyle = ctx.createPattern(textures.wood, 'repeat');
            if (fillType === 'brick') ctx.fillStyle = ctx.createPattern(textures.brick, 'repeat');
        }

        ctx.beginPath();
        if (currentTool === 'line') {
            ctx.moveTo(startX, startY); ctx.lineTo(x, y);
        } else if (currentTool === 'rect') {
            ctx.rect(startX, startY, x - startX, y - startY);
            if (fillType !== 'none') ctx.fill();
        } else if (currentTool === 'circle') {
            let r = Math.sqrt(Math.pow(x - startX, 2) + Math.pow(y - startY, 2));
            ctx.arc(startX, startY, r, 0, 2 * Math.PI);
            if (fillType !== 'none') ctx.fill();
        }
        ctx.stroke();
    }
};

const stopDraw = () => { isDrawing = false; };

// ИСПОЛЬЗУЕМ POINTER EVENTS (Универсально для ПК мыши, стилуса и пальца)
canvas.addEventListener('pointerdown', startDraw);
canvas.addEventListener('pointermove', drawing);
window.addEventListener('pointerup', stopDraw);
canvas.addEventListener('pointercancel', stopDraw);

// 6. РАБОТА С FIREBASE
db.ref('users').on('value', snap => {
    usersData = snap.val() || {};
    if(document.getElementById('hall-screen').classList.contains('active')) renderHallOfFame();
});

document.getElementById('publish-btn').addEventListener('click', () => {
    const title = document.getElementById('art-title').value.trim() || 'Без названия';
    
    // Временно убираем тени перед сохранением, чтобы они не дублировались
    ctx.shadowBlur = 0; 
    const dataUrl = canvas.toDataURL('image/png');
    
    db.ref('drawings').push().set({
        title: title, author: currentUser, imageUrl: dataUrl, timestamp: firebase.database.ServerValue.TIMESTAMP
    }).then(() => {
        document.getElementById('art-title').value = '';
        clearCanvasWhite();
        switchScreen('main-screen');
    });
});

db.ref('drawings').on('value', snap => {
    const data = snap.val() || {};
    const sortedIds = Object.keys(data).sort((a, b) => data[b].timestamp - data[a].timestamp);
    
    sortedIds.forEach(id => {
        const art = data[id];
        const existingCard = document.getElementById(`art-${id}`);
        const likesCount = art.likes ? Object.keys(art.likes).length : 0;
        const isLikedByMe = art.likes && art.likes[currentUser];
        const commentsHtml = generateCommentsHtml(art.comments);

        if (existingCard) {
            const likeBtn = existingCard.querySelector('.like-btn');
            likeBtn.innerHTML = `<i class="fa-solid fa-heart"></i> ${likesCount}`;
            isLikedByMe ? likeBtn.classList.add('liked') : likeBtn.classList.remove('liked');
            existingCard.querySelector('.comments-section').innerHTML = commentsHtml;
        } else {
            const card = document.createElement('div');
            card.className = 'art-card slide-up'; card.id = `art-${id}`;
            const isMyPost = art.author === currentUser;
            const avatar = usersData[art.author]?.avatar || `https://api.dicebear.com/6.x/bottts/svg?seed=${art.author}`;

            card.innerHTML = `
                <div class="art-header art-info">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <img src="${avatar}" width="30" height="30" style="border-radius:50%; cursor:pointer;" onclick="viewProfile('${art.author}')">
                        <div>
                            <div class="art-title">${art.title}</div>
                            <div class="art-author" onclick="viewProfile('${art.author}')">@${art.author}</div>
                        </div>
                    </div>
                </div>
                <img src="${art.imageUrl}" class="art-image" alt="Art">
                <div class="art-info">
                    <div class="art-actions">
                        <button class="like-btn ${isLikedByMe ? 'liked' : ''}" onclick="toggleLike('${id}')" ${isMyPost ? 'disabled' : ''}>
                            <i class="fa-solid fa-heart"></i> ${likesCount}
                        </button>
                        ${isMyPost ? `<div class="control-btns"><button class="btn-primary" onclick="editArt('${id}', '${art.imageUrl}')"><i class="fa-solid fa-pen"></i></button><button class="btn-danger" onclick="deleteArt('${id}')"><i class="fa-solid fa-trash"></i></button></div>` : ''}
                    </div>
                    <div class="comments-section" id="comments-${id}">${commentsHtml}</div>
                    <div class="comment-input-wrapper">
                        <input type="text" id="comment-input-${id}" placeholder="Написать коммент...">
                        <button class="btn-primary" onclick="addComment('${id}')"><i class="fa-solid fa-paper-plane"></i></button>
                    </div>
                </div>
            `;
            feedContainer.appendChild(card);
        }
    });

    document.querySelectorAll('.art-card').forEach(card => {
        if (!data[card.id.replace('art-', '')]) card.remove();
    });

    drawingsData = data;
});

function generateCommentsHtml(commentsObj) {
    if (!commentsObj) return '';
    return Object.values(commentsObj).map(c => `<div class="comment"><span class="comment-author" onclick="viewProfile('${c.author}')">${c.author}:</span> ${c.text}</div>`).join('');
}

window.toggleLike = function(id) {
    db.ref(`drawings/${id}`).transaction(post => {
        if (post && post.author !== currentUser) {
            if (!post.likes) post.likes = {};
            post.likes[currentUser] ? post.likes[currentUser] = null : post.likes[currentUser] = true;
        }
        return post;
    });
};

window.addComment = function(id) {
    const input = document.getElementById(`comment-input-${id}`);
    if (input.value.trim()) {
        db.ref(`drawings/${id}/comments`).push({ author: currentUser, text: input.value.trim() });
        input.value = '';
    }
};

window.deleteArt = function(id) { if (confirm('Удалить шедевр?')) db.ref(`drawings/${id}`).remove(); };

window.editArt = function(id, imageUrl) {
    const img = new Image();
    img.onload = () => {
        clearCanvasWhite();
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        switchScreen('draw-screen');
    };
    img.src = imageUrl;
};

// 7. ЗАЛ СЛАВЫ И ПРОФИЛЬ
function renderHallOfFame() {
    const userLikesCount = {};
    Object.values(drawingsData).forEach(art => {
        if (!userLikesCount[art.author]) userLikesCount[art.author] = 0;
        if (art.likes) userLikesCount[art.author] += Object.keys(art.likes).length;
    });

    const topUsers = Object.keys(usersData).map(nick => ({ nickname: nick, avatar: usersData[nick].avatar, likes: userLikesCount[nick] || 0 }))
        .sort((a, b) => b.likes - a.likes).slice(0, 10);

    hallContainer.innerHTML = topUsers.map((u, i) => `
        <div class="hall-card rank-${i + 1}" onclick="viewProfile('${u.nickname}')">
            <div class="hall-rank">#${i + 1}</div>
            <img src="${u.avatar}" class="hall-avatar" alt="Avatar">
            <div class="hall-info"><h3 class="neon-text">${u.nickname}</h3></div>
            <div class="hall-likes"><i class="fa-solid fa-heart"></i> ${u.likes}</div>
        </div>`).join('');
}

function renderProfile(nicknameTarget) {
    const target = nicknameTarget || currentUser;
    
    document.getElementById('change-avatar-btn').style.display = target === currentUser ? 'flex' : 'none';
    document.getElementById('profile-gallery-title').textContent = target === currentUser ? 'Мои работы' : `Работы пользователя: ${target}`;

    const userDrawings = Object.keys(drawingsData)
        .filter(id => drawingsData[id].author === target)
        .sort((a, b) => drawingsData[b].timestamp - drawingsData[a].timestamp);

    let totalLikes = 0;
    profileGallery.innerHTML = userDrawings.map(id => {
        const art = drawingsData[id];
        const likesCount = art.likes ? Object.keys(art.likes).length : 0;
        totalLikes += likesCount;
        return `
            <div class="art-card">
                <img src="${art.imageUrl}" class="art-image" alt="Art">
                <div class="art-info">
                    <div class="art-title">${art.title}</div>
                    <div class="art-actions">
                        <span style="color:var(--danger)"><i class="fa-solid fa-heart"></i> ${likesCount}</span>
                        ${target === currentUser ? `<div class="control-btns"><button class="btn-primary" onclick="editArt('${id}', '${art.imageUrl}')"><i class="fa-solid fa-pen"></i></button><button class="btn-danger" onclick="deleteArt('${id}')"><i class="fa-solid fa-trash"></i></button></div>` : ''}
                    </div>
                </div>
            </div>`;
    }).join('');

    if (userDrawings.length === 0) profileGallery.innerHTML = '<p class="text-center" style="grid-column: 1/-1;">Работ пока нет...</p>';
    
    document.getElementById('profile-nickname').textContent = target;
    document.getElementById('profile-likes').textContent = totalLikes;
    document.getElementById('profile-avatar').src = usersData[target]?.avatar || `https://api.dicebear.com/6.x/bottts/svg?seed=${target}`;
}

window.addEventListener('DOMContentLoaded', initAuth);
        
