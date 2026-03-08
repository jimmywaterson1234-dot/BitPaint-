import { initializeApp } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-app.js";
import { getDatabase, ref, set, get, onValue, push, remove, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-database.js";

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

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

document.addEventListener('DOMContentLoaded', () => {

    // --- DOM Элементы ---
    const screens = {
        login: document.getElementById('login-screen'),
        main: document.getElementById('main-screen'),
        profile: document.getElementById('profile-screen'),
        editor: document.getElementById('editor-screen')
    };

    const loginBtn = document.getElementById('login-button');
    const nickInput = document.getElementById('nickname-input');
    const nickError = document.getElementById('nickname-error');
    
    const drawBtn = document.getElementById('draw-button');
    const backToGalleryBtn = document.getElementById('back-to-gallery-button');
    const backFromProfileBtn = document.getElementById('back-from-profile-button');
    const editAvatarBtn = document.getElementById('edit-avatar-button');
    const publishBtn = document.getElementById('publish-button');
    
    const canvas = document.getElementById('paint-canvas');
    const ctx = canvas.getContext('2d');

    // --- Состояние приложения ---
    let currentUser = localStorage.getItem('bitpaint_currentUser'); 
    let allDrawings = []; // Храним все рисунки в памяти для фильтрации в профиле
    let currentViewedProfile = ''; 
    let publishMode = 'drawing'; // 'drawing' (в ленту) или 'avatar' (в профиль)

    // Рисование
    let isDrawing = false;
    let currentTool = 'pencil';
    let lastX, lastY, startX, startY, snapshotImg;

    // --- Логика входа ---
    if (currentUser) {
        showScreen('main');
    } else {
        showScreen('login');
    }

    loginBtn.addEventListener('click', async () => {
        const nickname = nickInput.value.trim();
        if (!nickname) return nickError.textContent = 'Введите ник';

        const userRef = ref(db, 'users/' + nickname);
        try {
            const snapshot = await get(userRef);
            if (snapshot.exists() && localStorage.getItem('bitpaint_currentUser') !== nickname) {
                 nickError.textContent = 'Этот ник уже занят.';
            } else {
                 if (!snapshot.exists()) {
                     // Создаем нового пользователя в базе
                     await set(userRef, { joined: serverTimestamp(), avatar: '' });
                 }
                 currentUser = nickname;
                 localStorage.setItem('bitpaint_currentUser', currentUser);
                 showScreen('main');
            }
        } catch (e) {
            console.error(e);
            nickError.textContent = 'Ошибка подключения к базе';
        }
    });

    // --- Управление экранами ---
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
        }
    }

    drawBtn.addEventListener('click', () => { publishMode = 'drawing'; showScreen('editor'); });
    backToGalleryBtn.addEventListener('click', () => { 
        if (publishMode === 'avatar') showProfile(currentUser);
        else showScreen('main');
    });
    backFromProfileBtn.addEventListener('click', () => showScreen('main'));
    editAvatarBtn.addEventListener('click', () => { publishMode = 'avatar'; showScreen('editor'); });

    // --- Глобальный перехват кликов по никам ---
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('clickable-nick')) {
            const nick = e.target.dataset.nick;
            if (nick) showProfile(nick);
        }
    });

    // --- ЛОГИКА ПРОФИЛЯ ---
    async function showProfile(nickname) {
        currentViewedProfile = nickname;
        showScreen('profile');

        // 1. Устанавливаем базовые данные
        document.getElementById('profile-nickname').textContent = '@' + nickname;
        editAvatarBtn.style.display = (nickname === currentUser) ? 'block' : 'none';

        // 2. Загружаем аватар пользователя
        const userRef = ref(db, 'users/' + nickname);
        onValue(userRef, (snapshot) => {
            const data = snapshot.val();
            const avatarImg = document.getElementById('profile-avatar-img');
            // Дефолтная картинка-заглушка, если аватара нет
            const defaultAvatar = `data:image/svg+xml;charset=UTF-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Crect fill='%231a1a2e' width='100' height='100'/%3E%3Ctext fill='%238a2be2' font-family='sans-serif' font-size='40' x='50' y='65' text-anchor='middle'%3E?%3C/text%3E%3C/svg%3E`;
            avatarImg.src = (data && data.avatar) ? data.avatar : defaultAvatar;
        }, { onlyOnce: true });

        // 3. Фильтруем рисунки только этого пользователя
        const userDrawings = allDrawings.filter(d => d.author === nickname);
        
        // 4. Считаем статистику
        const totalLikes = userDrawings.reduce((sum, drawing) => sum + drawing.likesList.length, 0);
        document.getElementById('profile-total-likes').textContent = totalLikes;
        document.getElementById('profile-total-drawings').textContent = userDrawings.length;

        // 5. Отрисовываем галерею профиля
        const profileGallery = document.getElementById('profile-gallery-container');
        profileGallery.innerHTML = '';
        if (userDrawings.length === 0) {
            profileGallery.innerHTML = '<p style="color:var(--secondary-text)">У пользователя пока нет рисунков.</p>';
        } else {
            userDrawings.forEach(d => renderDrawingCard(d, profileGallery));
        }
    }

    // --- МАГИЯ РЕАЛЬНОГО ВРЕМЕНИ ---
    function listenForDrawings() {
        const drawingsRef = ref(db, 'drawings');
        onValue(drawingsRef, (snapshot) => {
            allDrawings = [];
            snapshot.forEach((child) => {
                const drawing = child.val();
                drawing.id = child.key;
                drawing.likesList = drawing.likes ? Object.keys(drawing.likes) : [];
                drawing.commentsList = drawing.comments ? Object.values(drawing.comments) : [];
                allDrawings.push(drawing);
            });

            allDrawings.sort((a, b) => b.timestamp - a.timestamp); // Новые сверху

            // Если мы сейчас в ленте - обновляем её
            if (screens.main.classList.contains('active')) {
                const gallery = document.getElementById('gallery-container');
                gallery.innerHTML = '';
                allDrawings.forEach(d => renderDrawingCard(d, gallery));
            }
            // Если мы сейчас в чьем-то профиле - обновляем его профиль на лету
            else if (screens.profile.classList.contains('active')) {
                showProfile(currentViewedProfile);
            }
        });
    }

    // --- Отрисовка карточки (Универсальная для ленты и профиля) ---
    function renderDrawingCard(drawing, container) {
        const card = document.createElement('div');
        card.className = 'drawing-card';
        card.dataset.id = drawing.id;
        
        const isLiked = drawing.likesList.includes(currentUser);

        card.innerHTML = `
            <img src="${drawing.image}" alt="Рисунок от ${drawing.author}">
            <div class="card-info">
                <!-- Кликабельный ник -->
                <span class="author-nick clickable-nick" data-nick="${drawing.author}">@${drawing.author}</span>
                <div class="like-section">
                    <button class="like-btn ${isLiked ? 'liked' : ''}">
                        <i class="fas fa-heart"></i>
                    </button>
                    <span class="like-count">${drawing.likesList.length}</span>
                </div>
            </div>
            <div class="card-comments-section">
                <div class="comments-list">
                    ${drawing.commentsList.map(c => `
                        <div class="comment">
                            <strong class="clickable-nick" data-nick="${c.author}">@${c.author}:</strong> ${c.text}
                        </div>
                    `).join('')}
                </div>
                <form class="comment-input-form">
                    <input type="text" class="comment-input" placeholder="Комментировать..." required>
                    <button type="submit"><i class="fas fa-paper-plane"></i></button>
                </form>
            </div>
        `;

        // Обработчик лайка
        card.querySelector('.like-btn').addEventListener('click', async () => {
            const likeRef = ref(db, `drawings/${drawing.id}/likes/${currentUser}`);
            const snapshot = await get(likeRef);
            if (snapshot.exists()) await remove(likeRef);
            else await set(likeRef, true);
        });

        // Обработчик комментария
        card.querySelector('.comment-input-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const input = e.currentTarget.querySelector('.comment-input');
            const commentText = input.value.trim();
            if (commentText) {
                const commentsRef = ref(db, `drawings/${drawing.id}/comments`);
                await push(commentsRef, { author: currentUser, text: commentText, timestamp: serverTimestamp() });
                input.value = '';
            }
        });

        container.appendChild(card);
    }

    // --- ПУБЛИКАЦИЯ ---
    publishBtn.addEventListener('click', async () => {
        publishBtn.disabled = true;
        publishBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

        const imageURL = canvas.toDataURL('image/png'); 

        try {
            if (publishMode === 'avatar') {
                // Сохраняем как аватарку
                await set(ref(db, 'users/' + currentUser + '/avatar'), imageURL);
                showProfile(currentUser);
            } else {
                // Публикуем как обычный рисунок в ленту
                await push(ref(db, 'drawings'), { author: currentUser, image: imageURL, timestamp: serverTimestamp() });
                showScreen('main');
            }
        } catch (error) {
            console.error(error);
            alert("Ошибка сохранения!");
        }
        
        publishBtn.disabled = false;
        publishBtn.innerHTML = '<i class="fas fa-upload"></i> Готово';
    });

    // --- ЛОГИКА РИСОВАНИЯ (БЕЗ ИЗМЕНЕНИЙ) ---
    function setupCanvas() {
        const container = document.querySelector('.editor-container');
        canvas.width = container.offsetWidth;
        canvas.height = container.offsetHeight - document.querySelector('.toolbar').offsetHeight;
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = document.getElementById('color-picker').value;
        ctx.lineWidth = document.getElementById('line-width').value;
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    }

    function getCoords(e) {
        const rect = canvas.getBoundingClientRect();
        if (e.touches) return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
        return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }

    function startDrawing(e) {
        e.preventDefault();
        isDrawing = true;
        const coords = getCoords(e);
        [lastX, lastY, startX, startY] = [coords.x, coords.y, coords.x, coords.y];
        snapshotImg = ctx.getImageData(0, 0, canvas.width, canvas.height);
    }

    function draw(e) {
        if (!isDrawing) return;
        e.preventDefault();
        const coords = getCoords(e);
        ctx.strokeStyle = (currentTool === 'eraser') ? '#FFFFFF' : document.getElementById('color-picker').value;
        
        if (['pencil', 'eraser'].includes(currentTool)) {
            ctx.beginPath();
            ctx.moveTo(lastX, lastY); ctx.lineTo(coords.x, coords.y); ctx.stroke();
            [lastX, lastY] = [coords.x, coords.y];
        } else {
            ctx.putImageData(snapshotImg, 0, 0); 
            ctx.beginPath();
            if (currentTool === 'line') { ctx.moveTo(startX, startY); ctx.lineTo(coords.x, coords.y); } 
            else if (currentTool === 'rect') { ctx.strokeRect(startX, startY, coords.x - startX, coords.y - startY); } 
            else if (currentTool === 'circle') {
                ctx.arc(startX, startY, Math.sqrt(Math.pow(coords.x - startX, 2) + Math.pow(coords.y - startY, 2)), 0, 2 * Math.PI);
            }
            ctx.stroke();
        }
    }
    
    function stopDrawing() { isDrawing = false; ctx.beginPath(); }

    canvas.addEventListener('mousedown', startDrawing); canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDrawing); canvas.addEventListener('mouseout', stopDrawing);
    canvas.addEventListener('touchstart', startDrawing, { passive: false });
    canvas.addEventListener('touchmove', draw, { passive: false });
    canvas.addEventListener('touchend', stopDrawing);
    window.addEventListener('resize', setupCanvas);

    document.querySelectorAll('.tool-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelector('.tool-btn.active').classList.remove('active');
            btn.classList.add('active'); currentTool = btn.dataset.tool;
        });
    });

    document.getElementById('line-width').addEventListener('input', (e) => ctx.lineWidth = e.target.value);
    document.getElementById('color-picker').addEventListener('change', (e) => { ctx.strokeStyle = e.target.value; ctx.fillStyle = e.target.value; });
    document.getElementById('fill-canvas-btn').addEventListener('click', () => { ctx.fillStyle = document.getElementById('color-picker').value; ctx.fillRect(0, 0, canvas.width, canvas.height); });
});
                    
