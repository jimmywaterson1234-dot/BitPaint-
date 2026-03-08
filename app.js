// Конфигурация Firebase (Твои реальные ключи)
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

// Инициализация Firebase через Compat SDK (без type="module")
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// Глобальное состояние
const state = {
    user: null,
    currentView: 'feed'
};

// --- Менеджер приложения (Навигация, Авторизация, Рендер) ---
const app = {
    init() {
        const savedUser = localStorage.getItem('bitpaint_user');
        if (savedUser) {
            state.user = savedUser;
            this.loadUserData();
            this.showScreen('main-app');
            this.navigate('feed');
        }

        document.getElementById('login-btn').addEventListener('click', () => this.login());
        document.getElementById('login-nickname').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.login();
        });
    },

    login() {
        const nick = document.getElementById('login-nickname').value.trim();
        if (!nick) return alert('Введите никнейм!');
        if (nick.length < 3) return alert('Никнейм должен быть от 3 символов');

        const userRef = db.ref('users/' + nick);
        userRef.once('value', snapshot => {
            if (!snapshot.exists()) {
                // Создаем нового юзера с дефолтным прозрачным аватаром
                const defAvatar = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
                userRef.set({ joined: Date.now(), avatar: defAvatar });
            }
            localStorage.setItem('bitpaint_user', nick);
            state.user = nick;
            this.loadUserData();
            this.showScreen('main-app');
            this.navigate('feed');
        });
    },

    loadUserData() {
        document.getElementById('nav-nickname').textContent = state.user;
        document.getElementById('profile-name').textContent = state.user;
        db.ref('users/' + state.user + '/avatar').on('value', snap => {
            const avatar = snap.val() || '';
            document.getElementById('nav-avatar').src = avatar;
            document.getElementById('profile-avatar').src = avatar;
        });
    },

    showScreen(screenId) {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        document.getElementById(screenId).classList.add('active');
    },

    navigate(viewId) {
        state.currentView = viewId;
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        document.getElementById(`${viewId}-view`).classList.add('active');

        if (viewId === 'feed' || viewId === 'profile') this.listenDrawings();
        if (viewId === 'leaderboard') this.renderLeaderboard();
    },

    // Умный рендеринг (DOM Diffing)
    listenDrawings() {
        db.ref('drawings').off(); // Отписываемся от старых слушателей
        db.ref('drawings').on('value', snapshot => {
            const data = snapshot.val() || {};
            
            // Преобразуем в массив и сортируем по времени (новые сверху)
            const drawingsArr = Object.entries(data).map(([id, val]) => ({ id, ...val }))
                                      .sort((a, b) => b.timestamp - a.timestamp);

            const isProfile = state.currentView === 'profile';
            const containerId = isProfile ? 'profile-grid' : 'feed-grid';
            const container = document.getElementById(containerId);
            
            // Получаем текущие ID в DOM
            const existingIds = Array.from(container.children).map(el => el.dataset.id);
            const newIds = drawingsArr.filter(d => isProfile ? d.author === state.user : true).map(d => d.id);

            // Удаляем те, которых больше нет
            existingIds.forEach(id => {
                if (!newIds.includes(id)) {
                    const el = document.getElementById(`post-${id}`);
                    if (el) el.remove();
                }
            });

            // Статистика профиля
            if (isProfile) {
                let totalLikes = 0;
                newIds.forEach(id => { totalLikes += Object.keys(data[id].likes || {}).length; });
                document.getElementById('profile-works').textContent = newIds.length;
                document.getElementById('profile-likes').textContent = totalLikes;
            }

            // Рендер / Обновление (DOM Diffing)
            drawingsArr.forEach((draw, index) => {
                if (isProfile && draw.author !== state.user) return;

                let card = document.getElementById(`post-${draw.id}`);
                const likesCount = Object.keys(draw.likes || {}).length;
                const isLiked = draw.likes && draw.likes[state.user];

                if (!card) {
                    // Создаем карточку, если её нет
                    card = document.createElement('div');
                    card.className = 'post-card';
                    card.id = `post-${draw.id}`;
                    card.dataset.id = draw.id;
                    card.innerHTML = `
                        <img src="${draw.image}" class="post-img" alt="${draw.title}">
                        <div class="post-info">
                            <div class="post-header">
                                <span class="post-title">${this.escapeHTML(draw.title)}</span>
                                <span class="post-author">@${draw.author}</span>
                            </div>
                            <div class="post-actions">
                                <i class="fa-solid fa-heart like-btn ${isLiked ? 'liked' : ''}" onclick="app.toggleLike('${draw.id}', this)"> <span class="likes-count">${likesCount}</span></i>
                                ${draw.author === state.user ? `
                                    <div class="post-controls">
                                        <button onclick="canvasEngine.openEditor('edit', '${draw.id}')"><i class="fa-solid fa-pencil"></i></button>
                                        <button onclick="app.deletePost('${draw.id}')"><i class="fa-solid fa-trash"></i></button>
                                    </div>
                                ` : ''}
                            </div>
                            <div class="comments-section">
                                <div class="comments-list" id="comments-${draw.id}"></div>
                                <div class="comment-input">
                                    <input type="text" id="comm-input-${draw.id}" placeholder="Комментарий..." onkeypress="app.addComment(event, '${draw.id}')">
                                </div>
                            </div>
                        </div>
                    `;
                    container.appendChild(card);
                } else {
                    // Точечное обновление существующей карточки
                    const likeBtn = card.querySelector('.like-btn');
                    const countSpan = card.querySelector('.likes-count');
                    
                    if (parseInt(countSpan.textContent) !== likesCount) {
                        countSpan.textContent = likesCount;
                    }
                    
                    if (isLiked && !likeBtn.classList.contains('liked')) {
                        likeBtn.classList.add('liked');
                    } else if (!isLiked && likeBtn.classList.contains('liked')) {
                        likeBtn.classList.remove('liked');
                    }
                    
                    // Обновление картинки (если отредактировали)
                    const img = card.querySelector('.post-img');
                    if (img.src !== draw.image) img.src = draw.image;
                }

                // CSS Grid order для сортировки без перестроения DOM
                card.style.order = index;

                // Обновление комментариев
                this.renderComments(draw.id, draw.comments || {});
            });
        });
    },

    renderComments(postId, commentsObj) {
        const container = document.getElementById(`comments-${postId}`);
        if (!container) return;
        
        const commentsHtml = Object.values(commentsObj)
            .sort((a, b) => a.timestamp - b.timestamp)
            .map(c => `<div class="comment"><b>${c.author}:</b> ${this.escapeHTML(c.text)}</div>`)
            .join('');
            
        if (container.innerHTML !== commentsHtml) {
            container.innerHTML = commentsHtml;
            container.scrollTop = container.scrollHeight;
        }
    },

    toggleLike(postId, btnElement) {
        const ref = db.ref(`drawings/${postId}/likes/${state.user}`);
        ref.once('value', snap => {
            if (snap.exists()) {
                ref.remove();
            } else {
                ref.set(true);
                // Анимация heartPop (принудительный reflow)
                btnElement.classList.remove('pop-anim');
                void btnElement.offsetWidth; 
                btnElement.classList.add('pop-anim');
            }
        });
    },

    addComment(e, postId) {
        if (e.key === 'Enter') {
            const input = document.getElementById(`comm-input-${postId}`);
            const text = input.value.trim();
            if (!text) return;
            db.ref(`drawings/${postId}/comments`).push({
                author: state.user,
                text: text,
                timestamp: Date.now()
            });
            input.value = '';
        }
    },

    deletePost(postId) {
        if (window.confirm("Точно удалить шедевр?")) {
            db.ref(`drawings/${postId}`).remove();
        }
    },

    renderLeaderboard() {
        db.ref('drawings').once('value', snap => {
            const data = snap.val() || {};
            const userLikes = {};
            
            // Считаем лайки
            Object.values(data).forEach(draw => {
                const likes = Object.keys(draw.likes || {}).length;
                userLikes[draw.author] = (userLikes[draw.author] || 0) + likes;
            });

            // Получаем аватарки пользователей для зала славы
            db.ref('users').once('value', usersSnap => {
                const usersData = usersSnap.val() || {};
                
                const top = Object.entries(userLikes)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 10);

                const list = document.getElementById('leaderboard-list');
                list.innerHTML = top.map(([user, likes], idx) => {
                    const avatar = usersData[user]?.avatar || '';
                    return `
                        <div class="lb-item">
                            <div class="lb-user">
                                <b>#${idx + 1}</b>&nbsp;&nbsp;
                                <img src="${avatar}" alt="ava">
                                <span>${user}</span>
                            </div>
                            <div class="lb-likes"><i class="fa-solid fa-heart"></i> ${likes}</div>
                        </div>
                    `;
                }).join('');
            });
        });
    },

    escapeHTML(str) {
        return str.replace(/[&<>'"]/g, tag => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
        }[tag]));
    }
};

// --- Движок Canvas ---
const canvasEngine = {
    canvas: document.getElementById('drawing-board'),
    ctx: null,
    mode: 'new', // 'new', 'edit', 'avatar'
    editId: null,
    isDrawing: false,
    history: [],
    historyStep: -1,
    
    currentTool: 'pencil',
    startX: 0,
    startY: 0,
    savedImageData: null,

    init() {
        this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
        this.bindEvents();
    },

    bindEvents() {
        // Выбор инструмента
        document.querySelectorAll('.tool-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
                const target = e.currentTarget;
                target.classList.add('active');
                this.currentTool = target.dataset.tool;
            });
        });

        // Мышь и Touch (с preventDefault для блокировки скролла)
        const start = (e) => { e.preventDefault(); this.startDraw(e); };
        const move = (e) => { e.preventDefault(); this.draw(e); };
        const end = (e) => { e.preventDefault(); this.stopDraw(e); };

        this.canvas.addEventListener('mousedown', start);
        this.canvas.addEventListener('mousemove', move);
        this.canvas.addEventListener('mouseup', end);
        this.canvas.addEventListener('mouseout', end);

        this.canvas.addEventListener('touchstart', start, {passive: false});
        this.canvas.addEventListener('touchmove', move, {passive: false});
        this.canvas.addEventListener('touchend', end, {passive: false});

        // Undo
        document.getElementById('btn-undo').addEventListener('click', () => this.undo());
        window.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'z') this.undo();
        });

        // Сохранение
        document.getElementById('btn-save').addEventListener('click', () => this.save());
    },

    getMousePos(e) {
        const rect = this.canvas.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        return {
            x: clientX - rect.left,
            y: clientY - rect.top
        };
    },

    openEditor(mode, editId = null) {
        this.mode = mode;
        this.editId = editId;
        app.navigate('canvas');

        // Настройка размера
        if (mode === 'avatar') {
            this.canvas.width = 400;
            this.canvas.height = 400;
        } else {
            this.canvas.width = 800;
            this.canvas.height = 600;
        }

        this.ctx.fillStyle = '#ffffff';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        this.history = [];
        this.historyStep = -1;

        if (mode === 'edit' && editId) {
            db.ref(`drawings/${editId}`).once('value', snap => {
                const img = new Image();
                img.onload = () => {
                    this.ctx.drawImage(img, 0, 0);
                    this.saveState();
                };
                img.src = snap.val().image;
            });
        } else {
            this.saveState();
        }
    },

    applySettings() {
        const size = parseInt(document.getElementById('brush-size').value);
        let color = document.getElementById('brush-color').value;
        const isNeon = document.getElementById('neon-toggle').checked;

        if (this.currentTool === 'eraser') color = '#ffffff';

        this.ctx.lineWidth = size;
        this.ctx.strokeStyle = color;
        this.ctx.fillStyle = color;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';

        if (isNeon && this.currentTool !== 'eraser') {
            this.ctx.shadowBlur = size + 10;
            this.ctx.shadowColor = color;
        } else {
            this.ctx.shadowBlur = 0;
            this.ctx.shadowColor = 'transparent';
        }
    },

    startDraw(e) {
        this.isDrawing = true;
        const pos = this.getMousePos(e);
        this.startX = pos.x;
        this.startY = pos.y;
        this.applySettings();

        if (this.currentTool === 'picker') {
            this.pickColor(pos.x, pos.y);
            this.isDrawing = false;
            return;
        }

        if (this.currentTool === 'fill') {
            this.floodFill(Math.floor(pos.x), Math.floor(pos.y), this.ctx.fillStyle);
            this.saveState();
            this.isDrawing = false;
            return;
        }

        // Для фигур сохраняем холст
        if (['line', 'rect', 'circle'].includes(this.currentTool)) {
            this.savedImageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
        }

        this.ctx.beginPath();
        this.ctx.moveTo(this.startX, this.startY);
    },

    draw(e) {
        if (!this.isDrawing) return;
        const pos = this.getMousePos(e);

        if (['pencil', 'eraser'].includes(this.currentTool)) {
            this.ctx.lineTo(pos.x, pos.y);
            this.ctx.stroke();
        } else if (['line', 'rect', 'circle'].includes(this.currentTool)) {
            // Восстанавливаем сохраненный холст перед отрисовкой фигуры (превью)
            this.ctx.putImageData(this.savedImageData, 0, 0);
            this.ctx.beginPath();
            
            if (this.currentTool === 'line') {
                this.ctx.moveTo(this.startX, this.startY);
                this.ctx.lineTo(pos.x, pos.y);
                this.ctx.stroke();
            } else if (this.currentTool === 'rect') {
                const w = pos.x - this.startX;
                const h = pos.y - this.startY;
                this.drawShape(() => this.ctx.rect(this.startX, this.startY, w, h));
            } else if (this.currentTool === 'circle') {
                const radius = Math.sqrt(Math.pow(pos.x - this.startX, 2) + Math.pow(pos.y - this.startY, 2));
                // Исправление бага математики круга
                this.ctx.moveTo(this.startX + radius, this.startY);
                this.drawShape(() => this.ctx.arc(this.startX, this.startY, radius, 0, Math.PI * 2));
            }
        }
    },

    stopDraw() {
        if (!this.isDrawing) return;
        this.isDrawing = false;
        if (!['picker', 'fill'].includes(this.currentTool)) {
            this.ctx.closePath();
            this.saveState();
        }
    },

    drawShape(pathFunc) {
        const doFill = document.getElementById('fill-shape').checked;
        const texture = document.getElementById('texture-select').value;
        
        pathFunc();
        
        if (doFill) {
            const oldFill = this.ctx.fillStyle;
            if (texture !== 'none') {
                this.ctx.fillStyle = this.getTexturePattern(texture);
            }
            this.ctx.fill();
            this.ctx.fillStyle = oldFill;
        }
        this.ctx.stroke();
    },

    // Генерация процедурных текстур
    getTexturePattern(type) {
        const tCanv = document.createElement('canvas');
        const tCtx = tCanv.getContext('2d');
        tCanv.width = 40; tCanv.height = 40;
        
        tCtx.fillStyle = this.ctx.fillStyle; // Базовый цвет
        tCtx.fillRect(0,0,40,40);
        tCtx.strokeStyle = 'rgba(0,0,0,0.5)';
        tCtx.lineWidth = 1;

        if (type === 'bricks') {
            tCtx.strokeRect(0, 0, 20, 15);
            tCtx.strokeRect(20, 0, 20, 15);
            tCtx.strokeRect(-10, 15, 20, 15);
            tCtx.strokeRect(10, 15, 20, 15);
            tCtx.strokeRect(30, 15, 20, 15);
        } else if (type === 'wood') {
            tCtx.beginPath();
            for(let i=0; i<5; i++) {
                tCtx.moveTo(0, i*8 + Math.random()*4);
                tCtx.bezierCurveTo(15, i*8-2, 25, i*8+5, 40, i*8);
            }
            tCtx.stroke();
        } else if (type === 'stone') {
            for(let i=0; i<20; i++) {
                tCtx.beginPath();
                tCtx.arc(Math.random()*40, Math.random()*40, Math.random()*4+1, 0, Math.PI*2);
                tCtx.stroke();
            }
        }
        return this.ctx.createPattern(tCanv, 'repeat');
    },

    // Оптимизированн
