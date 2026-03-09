/**
 * BITPAINT APP LOGIC
 * Senior Frontend & UI/UX Design Implementation
 */

// -----------------------------------------------------
// 1. КОНФИГУРАЦИЯ FIREBASE (ТВОИ ДАННЫЕ)
// -----------------------------------------------------
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

// Инициализация Firebase v8 (строго без ES-модулей для работы локально)
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// -----------------------------------------------------
// 2. ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ И СОСТОЯНИЯ
// -----------------------------------------------------
let currentUser = null;
let drawingsData = {}; // Локальный кэш данных для умного рендера
let usersData = {};    // Локальный кэш юзеров

// DOM Элементы
const screens = document.querySelectorAll('.screen');
const navBtns = document.querySelectorAll('.nav-btn');
const feedContainer = document.getElementById('feed-container');
const profileGallery = document.getElementById('profile-gallery');
const hallContainer = document.getElementById('hall-container');

// -----------------------------------------------------
// 3. АВТОРИЗАЦИЯ И ПРОФИЛЬ
// -----------------------------------------------------
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
        } else {
            alert('Никнейм должен быть не короче 3 символов!');
        }
    });

    document.getElementById('nav-profile-btn').addEventListener('click', () => {
        switchScreen('profile-screen');
        renderProfile();
    });

    document.getElementById('change-avatar-btn').addEventListener('click', () => {
        const newUrl = prompt('Введите URL новой аватарки:', usersData[currentUser]?.avatar || '');
        if (newUrl) {
            db.ref('users/' + currentUser).update({ avatar: newUrl });
        }
    });
}

function checkAndCreateUserNode() {
    const userRef = db.ref('users/' + currentUser);
    userRef.once('value', snapshot => {
        if (!snapshot.exists()) {
            userRef.set({
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
        const data = snap.val();
        if (data && data.avatar) {
            document.getElementById('header-avatar').src = data.avatar;
        }
    });
}

// -----------------------------------------------------
// 4. НАВИГАЦИЯ
// -----------------------------------------------------
function switchScreen(screenId) {
    screens.forEach(s => s.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
    
    navBtns.forEach(btn => btn.classList.remove('active'));
    const activeBtn = document.querySelector(`.nav-btn[data-target="${screenId}"]`);
    if (activeBtn) activeBtn.classList.add('active');

    if (screenId === 'draw-screen') initCanvas();
    if (screenId === 'hall-screen') renderHallOfFame();
    if (screenId === 'profile-screen') renderProfile();
}

navBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
        switchScreen(e.currentTarget.dataset.target);
    });
});

// -----------------------------------------------------
// 5. ДВИЖОК РИСОВАНИЯ (CANVAS API)
// -----------------------------------------------------
const canvas = document.getElementById('paint-canvas');
const ctx = canvas.getContext('2d', { willReadFrequently: true });
let isDrawing = false;
let currentTool = 'pencil';
let startX, startY, snapshot;

function getCoordinates(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    let clientX = e.clientX;
    let clientY = e.clientY;

    if (e.touches && e.touches.length > 0) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
    }

    return {
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top) * scaleY
    };
}

function clearCanvasWhite() {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function initCanvas() {
    if (!canvas.getAttribute('data-init')) {
        clearCanvasWhite();
        canvas.setAttribute('data-init', 'true');
    }
}

// Инструменты
document.querySelectorAll('.tool-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
        currentTool = e.currentTarget.dataset.tool;
    });
});

document.getElementById('clear-canvas').addEventListener('click', clearCanvasWhite);

const startDraw = (e) => {
    isDrawing = true;
    const {x, y} = getCoordinates(e);
    startX = x;
    startY = y;
    
    snapshot = ctx.getImageData(0, 0, canvas.width, canvas.height);

    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineWidth = document.getElementById('brush-size').value;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    if (currentTool === 'eraser') {
        ctx.strokeStyle = '#ffffff';
    } else {
        ctx.strokeStyle = document.getElementById('color-picker').value;
    }

    if (currentTool === 'picker') {
        const pixelData = ctx.getImageData(x, y, 1, 1).data;
        const hex = "#" + ("000000" + rgbToHex(pixelData[0], pixelData[1], pixelData[2])).slice(-6);
        document.getElementById('color-picker').value = hex;
        document.querySelector('[data-tool="pencil"]').click();
        isDrawing = false;
    }
};

const drawing = (e) => {
    if (!isDrawing) return;
    e.preventDefault();
    const {x, y} = getCoordinates(e);

    if (currentTool === 'pencil' || currentTool === 'eraser') {
        ctx.lineTo(x, y);
        ctx.stroke();
    } else if (currentTool === 'line') {
        ctx.putImageData(snapshot, 0, 0);
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(x, y);
        ctx.stroke();
    } else if (currentTool === 'rect') {
        ctx.putImageData(snapshot, 0, 0);
        ctx.strokeRect(startX, startY, x - startX, y - startY);
    } else if (currentTool === 'circle') {
        ctx.putImageData(snapshot, 0, 0);
        ctx.beginPath();
        let radius = Math.sqrt(Math.pow(x - startX, 2) + Math.pow(y - startY, 2));
        ctx.arc(startX, startY, radius, 0, 2 * Math.PI);
        ctx.stroke();
    }
};

const stopDraw = () => { isDrawing = false; };

function rgbToHex(r, g, b) {
    return (r << 16) | (g << 8) | b;
}

canvas.addEventListener('mousedown', startDraw);
canvas.addEventListener('mousemove', drawing);
canvas.addEventListener('mouseup', stopDraw);
canvas.addEventListener('mouseleave', stopDraw);

canvas.addEventListener('touchstart', startDraw, {passive: false});
canvas.addEventListener('touchmove', drawing, {passive: false});
canvas.addEventListener('touchend', stopDraw);

// -----------------------------------------------------
// 6. РАБОТА С FIREBASE (УМНЫЙ РЕНДЕРИНГ, ЛАЙКИ, КОММЕНТЫ)
// -----------------------------------------------------
db.ref('users').on('value', snap => {
    usersData = snap.val() || {};
    renderHallOfFame();
});

// Публикация рисунка
document.getElementById('publish-btn').addEventListener('click', () => {
    const title = document.getElementById('art-title').value.trim() || 'Без названия';
    const dataUrl = canvas.toDataURL('image/png');
    
    const newArtRef = db.ref('drawings').push();
    newArtRef.set({
        title: title,
        author: currentUser,
        imageUrl: dataUrl,
        timestamp: firebase.database.ServerValue.TIMESTAMP
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
            
            if (isLikedByMe) {
                likeBtn.classList.add('liked');
            } else {
                likeBtn.classList.remove('liked');
            }

            existingCard.querySelector('.comments-section').innerHTML = commentsHtml;
        } else {
            const card = document.createElement('div');
            card.className = 'art-card slide-up';
            card.id = `art-${id}`;
            
            const isMyPost = art.author === currentUser;
            const authorAvatar = usersData[art.author]?.avatar || `https://api.dicebear.com/6.x/bottts/svg?seed=${art.author}`;

            card.innerHTML = `
                <div class="art-header art-info">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <img src="${authorAvatar}" width="30" height="30" style="border-radius:50%; background:#fff;">
                        <div>
                            <div class="art-title">${art.title}</div>
                            <div class="art-author">@${art.author}</div>
                        </div>
                    </div>
                </div>
                <img src="${art.imageUrl}" class="art-image" alt="Art">
                <div class="art-info">
                    <div class="art-actions">
                        <button class="like-btn ${isLikedByMe ? 'liked' : ''}" 
                                onclick="toggleLike('${id}')" 
                                ${isMyPost ? 'disabled title="Свои посты лайкать нельзя"' : ''}>
                            <i class="fa-solid fa-heart"></i> ${likesCount}
                        </button>
                        ${isMyPost ? `
                            <div class="control-btns">
                                <button class="btn-primary" onclick="editArt('${id}', '${art.imageUrl}')"><i class="fa-solid fa-pen"></i></button>
                                <button class="btn-danger" onclick="deleteArt('${id}')"><i class="fa-solid fa-trash"></i></button>
                            </div>
                        ` : ''}
                    </div>
                    <div class="comments-section" id="comments-${id}">
                        ${commentsHtml}
                    </div>
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
        const id = card.id.replace('art-', '');
        if (!data[id]) card.remove();
    });

    drawingsData = data;
    if (document.getElementById('profile-screen').classList.contains('active')) {
        renderProfile();
    }
});

function generateCommentsHtml(commentsObj) {
    if (!commentsObj) return '';
    return Object.values(commentsObj).map(c => 
        `<div class="comment"><span>${c.author}:</span> ${c.text}</div>`
    ).join('');
}

window.toggleLike = function(id) {
    const postRef = db.ref(`drawings/${id}`);
    postRef.transaction(post => {
        if (post) {
            if (!post.likes) post.likes = {};
            if (post.author === currentUser) return;

            if (post.likes[currentUser]) {
                post.likes[currentUser] = null;
            } else {
                post.likes[currentUser] = true;
                setTimeout(() => {
                    const btn = document.querySelector(`#art-${id} .like-btn i`);
                    if(btn) {
                        btn.classList.add('pulse');
                        setTimeout(() => btn.classList.remove('pulse'), 300);
                    }
                }, 50);
            }
        }
        return post;
    });
};

window.addComment = function(id) {
    const input = document.getElementById(`comment-input-${id}`);
    const text = input.value.trim();
    if (text) {
        db.ref(`drawings/${id}/comments`).push({
            author: currentUser,
            text: text,
            timestamp: firebase.database.ServerValue.TIMESTAMP
        });
        input.value = '';
    }
};

window.deleteArt = function(id) {
    if (confirm('Точно удалить этот шедевр?')) {
        db.ref(`drawings/${id}`).remove();
    }
};

window.editArt = function(id, imageUrl) {
    const img = new Image();
    img.onload = () => {
        clearCanvasWhite();
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        switchScreen('draw-screen');
    };
    img.src = imageUrl;
};

// -----------------------------------------------------
// 7. ЗАЛ СЛАВЫ И ПРОФИЛЬ
// -----------------------------------------------------
function renderHallOfFame() {
    const userLikesCount = {};
    Object.values(drawingsData).forEach(art => {
        if (!userLikesCount[art.author]) userLikesCount[art.author] = 0;
        if (art.likes) {
            userLikesCount[art.author] += Object.keys(art.likes).length;
        }
    });

    const topUsers = Object.keys(usersData).map(nick => ({
        nickname: nick,
        avatar: usersData[nick].avatar,
        likes: userLikesCount[nick] || 0
    })).sort((a, b) => b.likes - a.likes).slice(0, 10);

    hallContainer.innerHTML = topUsers.map((u, index) => `
        <div class="hall-card rank-${index + 1}">
            <div class="hall-rank">#${index + 1}</div>
            <img src="${u.avatar}" class="hall-avatar" alt="Avatar">
            <div class="hall-info">
                <h3 class="neon-text">${u.nickname}</h3>
            </div>
            <div class="hall-likes">
                <i class="fa-solid fa-heart"></i> ${u.likes}
            </div>
        </div>
    `).join('');
}

function renderProfile() {
    const myDrawings = Object.keys(drawingsData)
        .filter(id => drawingsData[id].author === currentUser)
        .sort((a, b) => drawingsData[b].timestamp - drawingsData[a].timestamp);

    let totalMyLikes = 0;
    
    profileGallery.innerHTML = myDrawings.map(id => {
        const art = drawingsData[id];
        const likesCount = art.likes ? Object.keys(art.likes).length : 0;
        totalMyLikes += likesCount;
        
        return `
            <div class="art-card">
                <img src="${art.imageUrl}" class="art-image" alt="Art">
                <div class="art-info">
                    <div class="art-title">${art.title}</div>
                    <div class="art-actions">
                        <span style="color:var(--danger)"><i class="fa-solid fa-heart"></i> ${likesCount}</span>
                        <div class="control-btns">
                            <button class="btn-primary" onclick="editArt('${id}', '${art.imageUrl}')"><i class="fa-solid fa-pen"></i></button>
                            <button class="btn-danger" onclick="deleteArt('${id}')"><i class="fa-solid fa-trash"></i></button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    if (myDrawings.length === 0) {
        profileGallery.innerHTML = '<p class="text-center" style="grid-column: 1/-1;">У тебя пока нет работ. Время творить!</p>';
    }

    document.getElementById('profile-nickname').textContent = currentUser;
    document.getElementById('profile-likes').textContent = totalMyLikes;
    document.getElementById('profile-avatar').src = usersData[currentUser]?.avatar || `https://api.dicebear.com/6.x/bottts/svg?seed=${currentUser}`;
}

window.addEventListener('DOMContentLoaded', initAuth);
    
