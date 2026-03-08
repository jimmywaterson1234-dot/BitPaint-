import { initializeApp } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-app.js";
import { getDatabase, ref, set, get, onValue, push, remove, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-database.js";

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

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

document.addEventListener('DOMContentLoaded', () => {

    const screens = {
        login: document.getElementById('login-screen'),
        main: document.getElementById('main-screen'),
        profile: document.getElementById('profile-screen'),
        leaderboard: document.getElementById('leaderboard-screen'),
        editor: document.getElementById('editor-screen')
    };

    const loginBtn = document.getElementById('login-button');
    const nickInput = document.getElementById('nickname-input');
    const publishBtn = document.getElementById('publish-button');
    
    const canvas = document.getElementById('paint-canvas');
    const ctx = canvas.getContext('2d');

    let currentUser = localStorage.getItem('bitpaint_currentUser'); 
    let allDrawings = []; 
    let currentViewedProfile = ''; 
    let publishMode = 'drawing'; 

    // Редактор
    let isDrawing = false;
    let currentTool = 'pencil';
    let isNeonMode = false;
    let undoStack = []; 
    let lastX, lastY, startX, startY, snapshotImg;

    // Вход
    if (currentUser) showScreen('main');
    else showScreen('login');

    loginBtn.addEventListener('click', async () => {
        const nickname = nickInput.value.trim();
        if (!nickname) return;
        const userRef = ref(db, 'users/' + nickname);
        const snapshot = await get(userRef);
        if (snapshot.exists() && localStorage.getItem('bitpaint_currentUser') !== nickname) {
             document.getElementById('nickname-error').textContent = 'Этот ник занят.';
        } else {
             if (!snapshot.exists()) await set(userRef, { joined: serverTimestamp(), avatar: '' });
             currentUser = nickname;
             localStorage.setItem('bitpaint_currentUser', currentUser);
             showScreen('main');
        }
    });

    // Навигация
    function showScreen(screenName) {
        Object.values(screens).forEach(s => s.classList.remove('active'));
        screens[screenName].classList.add('active');

        if (screenName === 'main') {
            document.getElementById('current-user-nickname').textContent = '@' + currentUser;
            document.getElementById('current-user-nickname').dataset.nick = currentUser;
            publishMode = 'drawing';
            listenForDrawings(); 
        } else if (screenName === 'editor') {
            setTimeout(setupCanvas, 50); 
        } else if (screenName === 'leaderboard') {
            generateLeaderboard();
        }
    }

    document.getElementById('draw-button').addEventListener('click', () => { publishMode = 'drawing'; showScreen('editor'); });
    document.getElementById('back-to-gallery-button').addEventListener('click', () => { if(publishMode === 'avatar') showProfile(currentUser); else showScreen('main'); });
    document.getElementById('edit-avatar-button').addEventListener('click', () => { publishMode = 'avatar'; showScreen('editor'); });
    document.getElementById('leaderboard-button').addEventListener('click', () => showScreen('leaderboard'));
    document.querySelectorAll('.back-to-main').forEach(btn => btn.addEventListener('click', () => showScreen('main')));

    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('clickable-nick')) {
            const nick = e.target.dataset.nick;
            if (nick) showProfile(nick);
        }
    });

    // Топ-10
    function generateLeaderboard() {
        const stats = {};
        allDrawings.forEach(d => {
            if (!stats[d.author]) stats[d.author] = { likes: 0, drawings: 0 };
            stats[d.author].drawings++;
            stats[d.author].likes += d.likesList.length;
        });

        const sortedUsers = Object.entries(stats).map(([name, data]) => ({ name, ...data })).sort((a, b) => b.likes - a.likes || b.drawings - a.drawings).slice(0, 10);
        const list = document.getElementById('leaderboard-list');
        list.innerHTML = '';

        sortedUsers.forEach((user, index) => {
            const rankClass = index < 3 ? `rank-${index + 1}` : '';
            let rankIcon = `${index + 1}`;
            if (index === 0) rankIcon = '<i class="fas fa-trophy"></i>';
            if (index === 1) rankIcon = '<i class="fas fa-medal"></i>';
            if (index === 2) rankIcon = '<i class="fas fa-award"></i>';

            list.innerHTML += `
                <li class="leader-item ${rankClass}">
                    <div class="leader-rank">${rankIcon}</div>
                    <div class="leader-info"><span class="clickable-nick" data-nick="${user.name}">@${user.name}</span></div>
                    <div class="leader-stats"><i class="fas fa-heart"></i> ${user.likes} <span style="font-size:14px; color:var(--secondary-text); margin-left:10px;">(${user.drawings} рис.)</span></div>
                </li>
            `;
        });
    }

    // Профиль
    function showProfile(nickname) {
        currentViewedProfile = nickname;
        showScreen('profile');
        document.getElementById('profile-nickname').textContent = '@' + nickname;
        document.getElementById('edit-avatar-button').style.display = (nickname === currentUser) ? 'block' : 'none';

        onValue(ref(db, 'users/' + nickname), (snapshot) => {
            const data = snapshot.val();
            const defAvatar = `data:image/svg+xml;charset=UTF-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Crect fill='%231a1a2e' width='100' height='100'/%3E%3Ctext fill='%238a2be2' font-family='sans-serif' font-size='40' x='50' y='65' text-anchor='middle'%3E?%3C/text%3E%3C/svg%3E`;
            document.getElementById('profile-avatar-img').src = (data && data.avatar) ? data.avatar : defAvatar;
        }, { onlyOnce: true });

        const userDrawings = allDrawings.filter(d => d.author === nickname);
        document.getElementById('profile-total-likes').textContent = userDrawings.reduce((s, d) => s + d.likesList.length, 0);
        document.getElementById('profile-total-drawings').textContent = userDrawings.length;

        const gallery = document.getElementById('profile-gallery-container');
        gallery.innerHTML = '';
        if (userDrawings.length === 0) gallery.innerHTML = '<p style="color:var(--secondary-text)">Нет рисунков.</p>';
        else userDrawings.forEach(d => renderDrawingCard(d, gallery));
    }

    // Рендер галереи
    function listenForDrawings() {
        onValue(ref(db, 'drawings'), (snapshot) => {
            allDrawings = [];
            snapshot.forEach((child) => {
                const drawing = child.val();
                drawing.id = child.key;
                drawing.likesList = drawing.likes ? Object.keys(drawing.likes) : [];
                drawing.commentsList = drawing.comments ? Object.values(drawing.comments) : [];
                allDrawings.push(drawing);
            });
            allDrawings.sort((a, b) => b.timestamp - a.timestamp);

            if (screens.main.classList.contains('active')) {
                const gallery = document.getElementById('gallery-container');
                gallery.innerHTML = '';
                allDrawings.forEach(d => renderDrawingCard(d, gallery));
            } else if (screens.profile.classList.contains('active')) showProfile(currentViewedProfile);
            else if (screens.leaderboard.classList.contains('active')) generateLeaderboard();
        });
    }

    function renderDrawingCard(drawing, container) {
        const card = document.createElement('div');
        card.className = 'drawing-card';
        const isLiked = drawing.likesList.includes(currentUser);

        card.innerHTML = `
            <img src="${drawing.image}" alt="Рисунок">
            <div class="card-info">
                <span class="author-nick clickable-nick" data-nick="${drawing.author}">@${drawing.author}</span>
                <div class="like-section">
                    <button class="like-btn ${isLiked ? 'liked' : ''}"><i class="fas fa-heart"></i></button>
                    <span class="like-count">${drawing.likesList.length}</span>
                </div>
            </div>
            <div class="card-comments-section">
                <div class="comments-list">
                    ${drawing.commentsList.map(c => `<div class="comment"><strong class="clickable-nick" data-nick="${c.author}">@${c.author}:</strong> ${c.text}</div>`).join('')}
                </div>
                <form class="comment-input-form">
                    <input type="text" class="comment-input" placeholder="Комментировать..." required>
                    <button type="submit"><i class="fas fa-paper-plane"></i></button>
                </form>
            </div>
        `;

        card.querySelector('.like-btn').addEventListener('click', async () => {
            const likeRef = ref(db, `drawings/${drawing.id}/likes/${currentUser}`);
            const snap = await get(likeRef);
            if (snap.exists()) await remove(likeRef); else await set(likeRef, true);
        });

        card.querySelector('.comment-input-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const input = e.currentTarget.querySelector('.comment-input');
            if (input.value.trim()) {
                await push(ref(db, `drawings/${drawing.id}/comments`), { author: currentUser, text: input.value.trim(), timestamp: serverTimestamp() });
                input.value = '';
            }
        });
        container.appendChild(card);
    }

    // --- РЕДАКТОР ---

    function saveState() {
        undoStack.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
        if (undoStack.length > 15) undoStack.shift(); 
    }

    function undoLastAction() {
        if (undoStack.length > 1) {
            undoStack.pop(); 
            ctx.putImageData(undoStack[undoStack.length - 1], 0, 0); 
        } else if (undoStack.length === 1) {
            ctx.putImageData(undoStack[0], 0, 0);
        }
    }

    document.getElementById('undo-button').addEventListener('click', undoLastAction);
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.key === 'z' && screens.editor.classList.contains('active')) undoLastAction();
    });

    // ЛОГИКА ПЕРЕКЛЮЧЕНИЯ РЕЖИМОВ КИСТИ
    const modeNormalBtn = document.getElementById('mode-normal');
    const modeNeonBtn = document.getElementById('mode-neon');

    modeNormalBtn.addEventListener('click', () => {
        isNeonMode = false;
        modeNormalBtn.classList.add('active');
        modeNeonBtn.classList.remove('active');
    });

    modeNeonBtn.addEventListener('click', () => {
        isNeonMode = true;
        modeNeonBtn.classList.add('active');
        modeNormalBtn.classList.remove('active');
    });

    // Применение свечения
    function applyNeonEffect() {
        if (isNeonMode && currentTool !== 'eraser') {
            const width = parseInt(document.getElementById('line-width').value);
            ctx.shadowBlur = width * 2.5; // Сильное свечение
            ctx.shadowColor = document.getElementById('color-picker').value;
        } else {
            ctx.shadowBlur = 0;
        }
    }

    function setupCanvas() {
        const container = document.querySelector('.editor-container');
        canvas.width = container.offsetWidth;
        canvas.height = container.offsetHeight - document.querySelector('.toolbar').offsetHeight;
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        undoStack = []; 
        saveState();    
    }

    function startDrawing(e) {
        e.preventDefault();
        isDrawing = true;
        const rect = canvas.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        [lastX, lastY] = [clientX - rect.left, clientY - rect.top];
        [startX, startY] = [lastX, lastY];
        snapshotImg = ctx.getImageData(0, 0, canvas.width, canvas.height);
    }

    function draw(e) {
        if (!isDrawing) return;
        e.preventDefault();
        const rect = canvas.getBoundingClientRect();
        const currentX = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
        const currentY = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top;
        
        ctx.strokeStyle = (currentTool === 'eraser') ? '#FFFFFF' : document.getElementById('color-picker').value;
        ctx.lineWidth = document.getElementById('line-width').value;
        
        applyNeonEffect(); 
        
        if (['pencil', 'eraser'].includes(currentTool)) {
            ctx.beginPath();
            ctx.moveTo(lastX, lastY); ctx.lineTo(currentX, currentY); ctx.stroke();
            [lastX, lastY] = [currentX, currentY];
        } else {
            ctx.putImageData(snapshotImg, 0, 0); 
            ctx.beginPath();
            if (currentTool === 'line') { ctx.moveTo(startX, startY); ctx.lineTo(currentX, currentY); } 
            else if (currentTool === 'rect') { ctx.strokeRect(startX, startY, currentX - startX, currentY - startY); } 
            else if (currentTool === 'circle') { ctx.arc(startX, startY, Math.sqrt(Math.pow(currentX - startX, 2) + Math.pow(currentY - startY, 2)), 0, 2 * Math.PI); }
            ctx.stroke();
        }
    }
    
    function stopDrawing() { 
        if (isDrawing) {
            isDrawing = false; 
            ctx.beginPath();
            ctx.shadowBlur = 0; 
            saveState(); 
        }
    }

    canvas.addEventListener('mousedown', startDrawing); canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDrawing); canvas.addEventListener('mouseout', stopDrawing);
    canvas.addEventListener('touchstart', startDrawing, { passive: false });
    canvas.addEventListener('touchmove', draw, { passive: false });
    canvas.addEventListener('touchend', stopDrawing);
    window.addEventListener('resize', setupCanvas);

    document.querySelectorAll('.tool-btn').forEach(btn => {
        if(btn.id === 'undo-button') return;
        btn.addEventListener('click', () => {
            document.querySelector('.tool-btn.active')?.classList.remove('active');
            btn.classList.add('active'); currentTool = btn.dataset.tool;
        });
    });

    document.getElementById('fill-canvas-btn').addEventListener('click', () => { 
        ctx.fillStyle = document.getElementById('color-picker').value; 
        ctx.fillRect(0, 0, canvas.width, canvas.height); 
        saveState(); 
    });

    // Публикация
    publishBtn.addEventListener('click', async () => {
        publishBtn.disabled = true; publishBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        const imageURL = canvas.toDataURL('image/png'); 
        try {
            if (publishMode === 'avatar') {
                await set(ref(db, 'users/' + currentUser + '/avatar'), imageURL);
                showProfile(currentUser);
            } else {
                await push(ref(db, 'drawings'), { author: currentUser, image: imageURL, timestamp: serverTimestamp() });
                showScreen('main');
            }
        } catch (e) { console.error(e); alert("Ошибка!"); }
        publishBtn.disabled = false; publishBtn.innerHTML = '<i class="fas fa-upload"></i> Готово';
    });
});
                                                                   
