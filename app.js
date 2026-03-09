// ==========================================
// 1. FIREBASE ИНИЦИАЛИЗАЦИЯ (Твои ключи успешно интегрированы)
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

// Инициализируем Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// ==========================================
// 2. ГЛОБАЛЬНОЕ СОСТОЯНИЕ
// ==========================================
let currentUser = null;
let postsData = {}; 
let usersData = {};

// ==========================================
// 3. АВТОРИЗАЦИЯ И НАВИГАЦИЯ
// ==========================================
const authScreen = document.getElementById('auth-screen');
const appScreen = document.getElementById('app-screen');
const authBtn = document.getElementById('auth-btn');
const authNickname = document.getElementById('auth-nickname');

function generateAvatar(name) {
    return `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(name)}&backgroundColor=1a1a2e`;
}

function login(nickname) {
    if(nickname.length < 3) return alert('Никнейм от 3 символов!');
    currentUser = {
        name: nickname,
        avatar: localStorage.getItem(`avatar_${nickname}`) || generateAvatar(nickname)
    };
    localStorage.setItem('bitpaint_user', nickname);
    
    // Сохраняем/обновляем юзера в БД для зала славы
    db.ref(`users/${nickname}`).update({ name: nickname, avatar: currentUser.avatar });

    document.getElementById('nav-username').textContent = currentUser.name;
    document.getElementById('nav-avatar').src = currentUser.avatar;
    
    authScreen.classList.remove('active');
    appScreen.classList.add('active');
    initFirebaseListeners();
}

authBtn.addEventListener('click', () => login(authNickname.value.trim()));
if(localStorage.getItem('bitpaint_user')) {
    login(localStorage.getItem('bitpaint_user'));
}

// Навигация
document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        e.currentTarget.classList.add('active');
        document.getElementById(e.currentTarget.dataset.target).classList.add('active');
    });
});

// Открытие профиля
document.getElementById('my-profile-btn').addEventListener('click', () => openProfile(currentUser.name));

function openProfile(username) {
    const user = usersData[username] || { name: username, avatar: generateAvatar(username), totalLikes: 0 };
    document.getElementById('profile-name').textContent = user.name;
    document.getElementById('profile-avatar').src = user.avatar;
    document.getElementById('profile-likes').textContent = user.totalLikes || 0;
    
    const changeBtn = document.getElementById('change-avatar-btn');
    if(username === currentUser.name) {
        changeBtn.style.display = 'block';
        changeBtn.onclick = () => {
            const newUrl = prompt('Введите URL новой аватарки (прямую ссылку на картинку):');
            if(newUrl) {
                currentUser.avatar = newUrl;
                localStorage.setItem(`avatar_${username}`, newUrl);
                document.getElementById('profile-avatar').src = newUrl;
                document.getElementById('nav-avatar').src = newUrl;
                db.ref(`users/${username}`).update({ avatar: newUrl });
            }
        };
    } else {
        changeBtn.style.display = 'none';
    }

    // Рендер галереи пользователя
    const gallery = document.getElementById('profile-gallery');
    gallery.innerHTML = '';
    Object.values(postsData).filter(p => p.author === username).forEach(post => {
        const img = document.createElement('img');
        img.src = post.image;
        img.className = 'post-image glow-box';
        img.style.cursor = 'pointer';
        img.onclick = () => { document.querySelector('[data-target="feed-view"]').click(); };
        gallery.appendChild(img);
    });

    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById('profile-view').classList.add('active');
}

// ==========================================
// 4. ДВИЖОК РИСОВАНИЯ (CANVAS API)
// ==========================================
const canvas = document.getElementById('main-canvas');
const ctx = canvas.getContext('2d', { willReadFrequently: true });
let isDrawing = false, startX = 0, startY = 0, snapshot;
let undoStack = [];
let currentTool = 'pencil';

// Инициализация холста (белый фон)
function clearCanvas() {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    saveState();
}
if(undoStack.length === 0) clearCanvas();

// Сохранение состояния (до 20 шагов)
function saveState() {
    if (undoStack.length >= 20) undoStack.shift();
    undoStack.push(canvas.toDataURL());
}

document.getElementById('tool-undo').addEventListener('click', () => {
    if(undoStack.length > 1) {
        undoStack.pop(); // удаляем текущее
        const imgData = undoStack[undoStack.length - 1];
        const img = new Image();
        img.src = imgData;
        img.onload = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0);
        };
    } else if(undoStack.length === 1) {
        clearCanvas();
    }
});

// Инструменты
document.querySelectorAll('.tool-btn[data-tool]').forEach(btn => {
    btn.addEventListener('click', (e) => {
        document.querySelectorAll('.tool-btn[data-tool]').forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
        currentTool = e.currentTarget.dataset.tool;
    });
});

// Генерация текстур
function getFillStyle(color) {
    const type = document.getElementById('tool-texture').value;
    if (type === 'fill' || type === 'outline') return color;
    
    const patCanvas = document.createElement('canvas');
    const pCtx = patCanvas.getContext('2d');
    patCanvas.width = 20; patCanvas.height = 20;
    pCtx.fillStyle = color;
    pCtx.fillRect(0, 0, 20, 20);
    pCtx.strokeStyle = '#000';
    pCtx.lineWidth = 2;

    if (type === 'wood') {
        pCtx.beginPath();
        for(let i=0; i<5; i++) {
            pCtx.moveTo(0, Math.random()*20);
            pCtx.bezierCurveTo(5, Math.random()*20, 15, Math.random()*20, 20, Math.random()*20);
        }
        pCtx.stroke();
    } else if (type === 'brick') {
        pCtx.strokeRect(0, 0, 20, 10);
        pCtx.strokeRect(-10, 10, 20, 10);
        pCtx.strokeRect(10, 10, 20, 10);
    }
    return ctx.createPattern(patCanvas, 'repeat');
}

// Умная заливка (Flood Fill - Iterative)
function floodFill(startX, startY, fillColorHex) {
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imgData.data;
    
    const getPixelIdx = (x, y) => (y * canvas.width + x) * 4;
    const startIdx = getPixelIdx(startX, startY);
    const startR = data[startIdx], startG = data[startIdx+1], startB = data[startIdx+2], startA = data[startIdx+3];
    
    // Преобразуем hex в rgb
    const hex = fillColorHex.replace('#','');
    const fillR = parseInt(hex.substring(0,2), 16), fillG = parseInt(hex.substring(2,4), 16), fillB = parseInt(hex.substring(4,6), 16);

    if(startR === fillR && startG === fillG && startB === fillB) return; // Тот же цвет

    const matchStartColor = (idx) => data[idx] === startR && data[idx+1] === startG && data[idx+2] === startB && data[idx+3] === startA;
    const colorPixel = (idx) => { data[idx] = fillR; data[idx+1] = fillG; data[idx+2] = fillB; data[idx+3] = 255; };

    const pixelStack = [[startX, startY]];
    
    while(pixelStack.length) {
        let newPos = pixelStack.pop();
        let x = newPos[0], y = newPos[1];
        let pixelPos = getPixelIdx(x, y);
        
        while(y-- >= 0 && matchStartColor(pixelPos)) pixelPos -= canvas.width * 4;
        pixelPos += canvas.width * 4; ++y;
        
        let reachLeft = false, reachRight = false;
        while(y++ < canvas.height-1 && matchStartColor(pixelPos)) {
            colorPixel(pixelPos);
            if(x > 0) {
                if(matchStartColor(pixelPos - 4)) {
                    if(!reachLeft) { pixelStack.push([x - 1, y]); reachLeft = true; }
                } else if(reachLeft) reachLeft = false;
            }
            if(x < canvas.width - 1) {
                if(matchStartColor(pixelPos + 4)) {
                    if(!reachRight) { pixelStack.push([x + 1, y]); reachRight = true; }
                } else if(reachRight) reachRight = false;
            }
            pixelPos += canvas.width * 4;
        }
    }
    ctx.putImageData(imgData, 0, 0);
}

// Pointer Events
const getPointerPos = (e) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
};

const setupCtx = () => {
    const color = document.getElementById('tool-color').value;
    ctx.lineWidth = document.getElementById('tool-size').value;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = currentTool === 'eraser' ? '#ffffff' : color;
    ctx.fillStyle = currentTool === 'eraser' ? '#ffffff' : getFillStyle(color);
    
    if(document.getElementById('tool-neon').checked && currentTool !== 'eraser') {
        ctx.shadowBlur = 15;
        ctx.shadowColor = color;
    } else {
        ctx.shadowBlur = 0;
    }
};

canvas.addEventListener('pointerdown', (e) => {
    isDrawing = true;
    const pos = getPointerPos(e);
    startX = pos.x; startY = pos.y;
    setupCtx();

    if(currentTool === 'bucket') {
        floodFill(Math.floor(startX), Math.floor(startY), document.getElementById('tool-color').value);
        saveState();
        isDrawing = false;
        return;
    }

    if(currentTool === 'eyedropper') {
        const p = ctx.getImageData(startX, startY, 1, 1).data;
        const hex = "#" + ("000000" + ((p[0] << 16) | (p[1] << 8) | p[2]).toString(16)).slice(-6);
        document.getElementById('tool-color').value = hex;
        document.querySelector('[data-tool="pencil"]').click();
        isDrawing = false;
        return;
    }

    snapshot = ctx.getImageData(0, 0, canvas.width, canvas.height);
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    e.preventDefault(); // Защита от скролла на тачах
});

canvas.addEventListener('pointermove', (e) => {
    if (!isDrawing) return;
    const pos = getPointerPos(e);
    
    if (['line', 'rect', 'circle'].includes(currentTool)) {
        ctx.putImageData(snapshot, 0, 0);
    }

    if (currentTool === 'pencil' || currentTool === 'eraser') {
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
    } else if (currentTool === 'line') {
        ctx.beginPath(); ctx.moveTo(startX, startY); ctx.lineTo(pos.x, pos.y); ctx.stroke();
    } else if (currentTool === 'rect') {
        ctx.beginPath();
        ctx.rect(startX, startY, pos.x - startX, pos.y - startY);
        document.getElementById('tool-texture').value === 'outline' ? ctx.stroke() : ctx.fill();
    } else if (currentTool === 'circle') {
        ctx.beginPath();
        const radius = Math.sqrt(Math.pow(pos.x - startX, 2) + Math.pow(pos.y - startY, 2));
        ctx.arc(startX, startY, radius, 0, 2 * Math.PI);
        document.getElementById('tool-texture').value === 'outline' ? ctx.stroke() : ctx.fill();
    }
});

canvas.addEventListener('pointerup', () => {
    if(!isDrawing) return;
    isDrawing = false;
    saveState();
});

// ==========================================
// 5. СОЦИАЛЬНАЯ СЕТЬ (FIREBASE + DOM DIFFING)
// ==========================================

// Публикация
document.getElementById('publish-btn').addEventListener('click', () => {
    const title = document.getElementById('draw-title').value.trim() || 'Без названия';
    const dataUrl = canvas.toDataURL('image/jpeg', 0.8); // Сжимаем для Firebase
    
    const postRef = db.ref('posts').push();
    postRef.set({
        id: postRef.key,
        title: title,
        image: dataUrl,
        author: currentUser.name,
        authorAvatar: currentUser.avatar,
        timestamp: firebase.database.ServerValue.TIMESTAMP,
        likes: {},
        comments: {}
    }).then(() => {
        document.getElementById('draw-title').value = '';
        document.querySelector('[data-target="feed-view"]').click();
    });
});

// Инициализация Real-Time Listeners
function initFirebaseListeners() {
    db.ref('posts').on('value', (snapshot) => {
        const data = snapshot.val() || {};
        postsData = data;
        renderFeed(data);
        calculateHallOfFame(data);
    });
}

// Умный рендеринг ленты (DOM Diffing)
function renderFeed(data) {
    const container = document.getElementById('feed-container');
    const posts = Object.values(data).sort((a, b) => b.timestamp - a.timestamp);
    
    // Удаляем посты, которых больше нет в БД
    Array.from(container.children).forEach(child => {
        if(!data[child.dataset.id]) child.remove();
    });

    posts.forEach(post => {
        let card = document.getElementById(`post-${post.id}`);
        const likesCount = post.likes ? Object.keys(post.likes).length : 0;
        const isLikedByMe = post.likes && post.likes[currentUser.name];

        if (!card) {
            card = document.createElement('div');
            card.className = 'post-card glow-box';
            card.id = `post-${post.id}`;
            card.dataset.id = post.id;
            
            card.innerHTML = `
                <div class="post-header" onclick="openProfile('${post.author}')">
                    <img src="${post.authorAvatar}" alt="avatar">
                    <strong class="neon-text">${post.author}</strong>
                    <span style="margin-left:auto; color:#888; font-size:12px">${new Date(post.timestamp).toLocaleString()}</span>
                </div>
                <img src="${post.image}" class="post-image" alt="Art">
                <div class="post-actions">
                    <strong>${post.title}</strong>
                    <div style="display:flex; gap:10px;">
                        ${post.author === currentUser.name ? 
                            `<button class="btn btn-small btn-edit" title="Редактировать"><i class="fas fa-edit"></i></button>
                             <button class="btn btn-small btn-delete" style="background:var(--danger)"><i class="fas fa-trash"></i></button>` : ''}
                        <button class="like-btn ${isLikedByMe ? 'liked' : ''}" ${post.author === currentUser.name ? 'disabled' : ''}>
                            <i class="fas fa-heart"></i> <span class="like-count">${likesCount}</span>
                        </button>
                    </div>
                </div>
                <div class="post-comments">
                    <div class="comments-list"></div>
                    <div class="comment-input-wrapper">
                        <input type="text" class="comment-input" placeholder="Комментарий...">
                        <button class="btn btn-primary btn-small comment-submit"><i class="fas fa-paper-plane"></i></button>
                    </div>
                </div>
            `;
            
            if(container.firstChild) {
                container.insertBefore(card, container.firstChild);
            } else {
                container.appendChild(card);
            }

            // Обработчики
            card.querySelector('.like-btn').addEventListener('click', () => toggleLike(post.id));
            
            const submitComment = () => {
                const input = card.querySelector('.comment-input');
                const text = input.value.trim();
                if(text) {
                    db.ref(`posts/${post.id}/comments`).push({
                        author: currentUser.name,
                        text: text,
                        timestamp: Date.now()
                    });
                    input.value = '';
                }
            };
            card.querySelector('.comment-submit').addEventListener('click', submitComment);
            card.querySelector('.comment-input').addEventListener('keypress', (e) => e.key === 'Enter' && submitComment());

            if(post.author === currentUser.name) {
                card.querySelector('.btn-delete').addEventListener('click', () => db.ref(`posts/${post.id}`).remove());
                card.querySelector('.btn-edit').addEventListener('click', () => {
                    const img = new Image();
                    img.src = post.image;
                    img.onload = () => {
                        ctx.clearRect(0,0,canvas.width, canvas.height);
                        ctx.drawImage(img,0,0);
                        saveState();
                        document.querySelector('[data-target="draw-view"]').click();
                    };
                });
            }
        } else {
            // Diffing для лайков
            const likeBtn = card.querySelector('.like-btn');
            const likeCountSpan = card.querySelector('.like-count');
            
            if (parseInt(likeCountSpan.textContent) !== likesCount) {
                likeCountSpan.textContent = likesCount;
                likeBtn.querySelector('i').classList.remove('anim-pulse');
                void likeBtn.offsetWidth; 
                likeBtn.querySelector('i').classList.add('anim-pulse');
            }
            
            if (isLikedByMe) likeBtn.classList.add('liked');
            else likeBtn.classList.remove('liked');

            // Diffing для комментариев
            const commentsList = card.querySelector('.comments-list');
            const commentsData = post.comments || {};
            
            Object.keys(commentsData).forEach(commentId => {
                if(!document.getElementById(`comment-${commentId}`)) {
                    const cData = commentsData[commentId];
                    const cDiv = document.createElement('div');
                    cDiv.id = `comment-${commentId}`;
                    cDiv.className = 'comment anim-slide-right';
                    cDiv.innerHTML = `<strong onclick="openProfile('${cData.author}')">${cData.author}</strong>: ${cData.text}`;
                    commentsList.appendChild(cDiv);
                    commentsList.scrollTop = commentsList.scrollHeight;
                }
            });
        }
    });
}

// Транзакция лайка
function toggleLike(postId) {
    const postRef = db.ref(`posts/${postId}`);
    postRef.transaction((post) => {
        if (post) {
            if (!post.likes) post.likes = {};
            if (post.likes[currentUser.name]) {
                delete post.likes[currentUser.name];
            } else {
                post.likes[currentUser.name] = true;
            }
        }
        return post;
    });
}

// Зал Славы
function calculateHallOfFame(posts) {
    const userLikes = {};
    Object.values(posts).forEach(post => {
        const likes = post.likes ? Object.keys(post.likes).length : 0;
        if(!userLikes[post.author]) userLikes[post.author] = { name: post.author, avatar: post.authorAvatar, total: 0 };
        userLikes[post.author].total += likes;
    });

    const sortedUsers = Object.values(userLikes).sort((a, b) => b.total - a.total).slice(0, 10);
    
    sortedUsers.forEach(u => {
        if(!usersData[u.name]) usersData[u.name] = { ...u };
        usersData[u
