// === 1. ИНИЦИАЛИЗАЦИЯ FIREBASE ===
// ВАЖНО: Вставьте сюда данные вашего проекта Firebase Realtime Database
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_AUTH_DOMAIN",
    databaseURL: "YOUR_DATABASE_URL", // Обязательно для Realtime DB
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_STORAGE_BUCKET",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const db = firebase.database();

// === 2. ЯДРО ПРИЛОЖЕНИЯ И АВТОРИЗАЦИЯ ===
const app = {
    currentUser: null,
    usersCache: {},
    
    init() {
        const savedUser = localStorage.getItem('bitpaint_user');
        if (savedUser) {
            this.currentUser = savedUser;
            this.navigate('main-screen');
            this.loadUserData();
            this.listenToFeed();
        } else {
            this.navigate('auth-screen');
        }
    },

        login() {
        const nickname = document.getElementById('login-nickname').value.trim();
        if (nickname.length < 3) {
            alert('Никнейм должен быть от 3 символов!');
            return;
        }
        
        this.currentUser = nickname;
        localStorage.setItem('bitpaint_user', nickname);
        
        // 1. Сначала переключаем интерфейс, чтобы юзер видел, что кнопка работает
        this.navigate('main-screen');

        // 2. Оборачиваем работу с базой в try-catch для отлова ошибок
        try {
            db.ref('users/' + nickname).once('value')
                .then(snap => {
                    if (!snap.exists()) {
                        db.ref('users/' + nickname).set({ avatar: 'https://via.placeholder.com/100', totalLikes: 0 });
                    }
                })
                .catch(error => {
                    console.error("Ошибка доступа к Firebase:", error);
                    alert("Ошибка базы данных! Проверьте правила (Rules) в Firebase. Они должны быть .read: true, .write: true");
                });

            this.loadUserData();
            this.listenToFeed();
        } catch (error) {
            console.error("Критическая ошибка инициализации Firebase:", error);
            alert("Не удалось подключиться к базе данных. Проверьте ваш firebaseConfig в app.js!");
        }
    },
    
        const nickname = document.getElementById('login-nickname').value.trim();
        if (nickname.length < 3) return alert('Никнейм должен быть от 3 символов!');
        
        this.currentUser = nickname;
        localStorage.setItem('bitpaint_user', nickname);
        
        // Создаем юзера в БД, если его нет
        db.ref('users/' + nickname).once('value', snap => {
            if (!snap.exists()) {
                db.ref('users/' + nickname).set({ avatar: 'https://via.placeholder.com/100', totalLikes: 0 });
            }
        });

        this.navigate('main-screen');
        this.loadUserData();
        this.listenToFeed();
    },

    logout() {
        localStorage.removeItem('bitpaint_user');
        this.currentUser = null;
        this.navigate('auth-screen');
    },

    navigate(screenId) {
        document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
        document.getElementById(screenId).classList.remove('hidden');
        
        const header = document.getElementById('main-header');
        screenId === 'auth-screen' ? header.classList.add('hidden') : header.classList.remove('hidden');

        if (screenId === 'draw-screen') canvasApp.initCanvas();
        if (screenId === 'hall-screen') this.renderHallOfFame();
        if (screenId === 'profile-screen') this.renderProfile();
    },

    loadUserData() {
        document.getElementById('header-username').innerText = this.currentUser;
        db.ref('users').on('value', snap => {
            this.usersCache = snap.val() || {};
            const me = this.usersCache[this.currentUser];
            if (me && me.avatar) {
                document.getElementById('header-avatar').src = me.avatar;
                document.getElementById('profile-avatar').src = me.avatar;
            }
        });
    },

    updateAvatar() {
        const url = document.getElementById('avatar-url-input').value.trim();
        if (!url) return;
        db.ref('users/' + this.currentUser).update({ avatar: url });
        document.getElementById('avatar-url-input').value = '';
    },

    // === 3. УМНЫЙ РЕНДЕРИНГ И ЛЕНТА ===
    postsData: [],
    
    listenToFeed() {
        db.ref('posts').on('value', snapshot => {
            const posts = [];
            snapshot.forEach(child => { posts.push({ id: child.key, ...child.val() }); });
            this.postsData = posts.reverse(); // Новые сверху
            this.smartRenderFeed();
        });
    },

    smartRenderFeed() {
        const container = document.getElementById('feed-container');
        const renderedIds = new Set();

        this.postsData.forEach(post => {
            renderedIds.add(post.id);
            let card = document.getElementById(`post-${post.id}`);
            
            const authorAvatar = this.usersCache[post.author]?.avatar || 'https://via.placeholder.com/40';
            const isMe = post.author === this.currentUser;
            const hasLiked = post.likedBy && post.likedBy[this.currentUser];
            const likesCount = post.likes || 0;

            if (!card) {
                // Создание новой карточки (с анимацией)
                card = document.createElement('div');
                card.id = `post-${post.id}`;
                card.className = 'post-card neon-card slide-up';
                
                card.innerHTML = `
                    <div class="post-header">
                        <div class="post-author">
                            <img src="${authorAvatar}" class="author-avatar" alt="av">
                            <span>${post.author}</span>
                        </div>
                        ${isMe ? `<div>
                            <button onclick="app.editPost('${post.id}')" class="neon-btn" style="padding: 5px 10px; font-size: 0.8rem;"><i class="fas fa-edit"></i></button>
                            <button onclick="app.deletePost('${post.id}')" class="neon-btn" style="padding: 5px 10px; font-size: 0.8rem; border-color: red; color: red;"><i class="fas fa-trash"></i></button>
                        </div>` : ''}
                    </div>
                    <div class="post-title">${post.title || 'Без названия'}</div>
                    <img src="${post.image}" class="post-img" alt="art">
                    <div class="post-actions">
                        <button class="like-btn ${hasLiked ? 'liked' : ''}" ${isMe ? 'disabled' : ''} onclick="app.toggleLike('${post.id}')">
                            <i class="fas fa-heart"></i> <span class="likes-count">${likesCount}</span>
                        </button>
                    </div>
                    <div class="comments-section" id="comments-${post.id}"></div>
                    <div class="comment-box">
                        <input type="text" id="comment-input-${post.id}" class="comment-input" placeholder="Написать комментарий...">
                        <button onclick="app.addComment('${post.id}')" class="neon-btn" style="padding: 10px;"><i class="fas fa-paper-plane"></i></button>
                    </div>
                `;
                container.appendChild(card);
            } else {
                // Точечное обновление существующей карточки
                const likesSpan = card.querySelector('.likes-count');
                const likeBtn = card.querySelector('.like-btn');
                
                if (parseInt(likesSpan.innerText) !== likesCount) {
                    likesSpan.innerText = likesCount;
                    likeBtn.className = `like-btn ${hasLiked ? 'liked' : ''}`;
                    // Анимация пульса
                    const icon = likeBtn.querySelector('i');
                    icon.classList.remove('pulse');
                    void icon.offsetWidth; // trigger reflow
                    icon.classList.add('pulse');
                }
            }

            // Рендер комментариев
            const commentsContainer = document.getElementById(`comments-${post.id}`);
            const commentsHtml = post.comments ? Object.values(post.comments).map(c => 
                `<div class="comment"><strong>${c.author}:</strong> ${c.text}</div>`
            ).join('') : '';
            if (commentsContainer.innerHTML !== commentsHtml) {
                commentsContainer.innerHTML = commentsHtml;
            }
        });

        // Удаление удаленных постов из DOM
        Array.from(container.children).forEach(child => {
            const id = child.id.replace('post-', '');
            if (!renderedIds.has(id)) child.remove();
        });
    },

    toggleLike(postId) {
        const postRef = db.ref(`posts/${postId}`);
        postRef.transaction(post => {
            if (post) {
                if (!post.likedBy) post.likedBy = {};
                if (post.likedBy[this.currentUser]) {
                    post.likes--;
                    delete post.likedBy[this.currentUser];
                } else {
                    post.likes++;
                    post.likedBy[this.currentUser] = true;
                }
            }
            return post;
        });
    },

    addComment(postId) {
        const input = document.getElementById(`comment-input-${postId}`);
        const text = input.value.trim();
        if (!text) return;
        
        db.ref(`posts/${postId}/comments`).push({
            author: this.currentUser,
            text: text,
            timestamp: firebase.database.ServerValue.TIMESTAMP
        });
        input.value = '';
    },

    deletePost(postId) {
        if(confirm('Точно удалить этот арт?')) db.ref(`posts/${postId}`).remove();
    },

    editPost(postId) {
        const post = this.postsData.find(p => p.id === postId);
        if(!post) return;
        this.navigate('draw-screen');
        
        const img = new Image();
        img.onload = () => {
            canvasApp.initCanvas();
            canvasApp.ctx.drawImage(img, 0, 0, canvasApp.canvas.width, canvasApp.canvas.height);
        };
        img.src = post.image;
        document.getElementById('art-title').value = post.title;
    },

    // === 4. ЗАЛ СЛАВЫ И ПРОФИЛЬ ===
    renderHallOfFame() {
        const userLikes = {};
        this.postsData.forEach(p => {
            if (!userLikes[p.author]) userLikes[p.author] = 0;
            userLikes[p.author] += (p.likes || 0);
        });

        const sortedUsers = Object.keys(userLikes)
            .map(name => ({ name, likes: userLikes[name], avatar: this.usersCache[name]?.avatar || 'https://via.placeholder.com/50' }))
            .sort((a, b) => b.likes - a.likes)
            .slice(0, 10);

        const container = document.getElementById('hall-container');
        container.innerHTML = sortedUsers.map((u, i) => {
            let rankClass = i === 0 ? 'rank-1' : i === 1 ? 'rank-2' : i === 2 ? 'rank-3' : '';
            return `
                <div class="rank-card neon-card ${rankClass}">
                    <span>#${i + 1}</span>
                    <div class="rank-info">
                        <img src="${u.avatar}" alt="av">
                        <span>${u.name}</span>
                    </div>
                    <span><i class="fas fa-heart"></i> ${u.likes}</span>
                </div>
            `;
        }).join('');
    },

    renderProfile() {
        document.getElementById('profile-name').innerText = this.currentUser;
        
        const myPosts = this.postsData.filter(p => p.author === this.currentUser);
        const totalLikes = myPosts.reduce((sum, p) => sum + (p.likes || 0), 0);
        document.getElementById('profile-likes-total').innerText = totalLikes;

        const grid = document.getElementById('profile-grid');
        grid.innerHTML = myPosts.map(post => `
            <div class="post-card neon-card">
                <div class="post-title">${post.title}</div>
                <img src="${post.image}" class="post-img" alt="art">
                <div style="margin-top:10px;"><i class="fas fa-heart" style="color:var(--heart-color)"></i> ${post.likes || 0}</div>
            </div>
        `).join('');
    }
};

// === 5. ДВИЖОК РИСОВАНИЯ (CANVAS API) ===
const canvasApp = {
    canvas: null,
    ctx: null,
    isDrawing: false,
    tool: 'pencil',
    startX: 0, startY: 0,
    savedImage: null,

    initCanvas() {
        this.canvas = document.getElementById('paint-canvas');
        this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
        
        const wrapper = document.getElementById('canvas-wrapper');
        // Жесткое соотношение 16:9 для внутренних пикселей
        this.canvas.width = wrapper.clientWidth;
        this.canvas.height = wrapper.clientWidth * (9 / 16);

        // Жесткая белая заливка фона
        this.ctx.fillStyle = '#ffffff';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Привязка событий (с поддержкой Touch)
        this.canvas.onmousedown = this.startPos.bind(this);
        this.canvas.onmousemove = this.draw.bind(this);
        window.onmouseup = this.endPos.bind(this);

        this.canvas.ontouchstart = (e) => { e.preventDefault(); this.startPos(e.touches[0]); };
        this.canvas.ontouchmove = (e) => { e.preventDefault(); this.draw(e.touches[0]); };
        window.ontouchend = this.endPos.bind(this);
    },

    setTool(newTool) {
        this.tool = newTool;
        document.querySelectorAll('.tools button').forEach(b => b.classList.remove('active'));
        document.getElementById(`tool-${newTool}`).classList.add('active');
    },

    getPos(e) {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: (e.clientX - rect.left) * (this.canvas.width / rect.width),
            y: (e.clientY - rect.top) * (this.canvas.height / rect.height)
        };
    },

    startPos(e) {
        this.isDrawing = true;
        const pos = this.getPos(e);
        this.startX = pos.x;
        this.startY = pos.y;
        
        if (this.tool === 'eyedropper') {
            this.pickColor(pos.x, pos.y);
            this.isDrawing = false;
            return;
        }

        // Сохраняем стейт канваса для геометрических фигур
        this.savedImage = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
        
        this.ctx.beginPath();
        if (this.tool === 'pencil' || this.tool === 'eraser') {
            this.ctx.moveTo(this.startX, this.startY);
        }
    },

    draw(e) {
        if (!this.isDrawing) return;
        const pos = this.getPos(e);
        
        this.ctx.lineWidth = document.getElementById('line-width').value;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        
        if (this.tool === 'pencil' || this.tool === 'eraser') {
            this.ctx.strokeStyle = this.tool === 'eraser' ? '#ffffff' : document.getElementById('color-picker').value;
            this.ctx.lineTo(pos.x, pos.y);
            this.ctx.stroke();
        } else {
            // Восстанавливаем сохраненный холст перед отрисовкой фигуры для превью
            this.ctx.putImageData(this.savedImage, 0, 0);
            this.ctx.beginPath();
            this.ctx.strokeStyle = document.getElementById('color-picker').value;

            if (this.tool === 'line') {
                this.ctx.moveTo(this.startX, this.startY);
                this.ctx.lineTo(pos.x, pos.y);
            } else if (this.tool === 'rect') {
                this.ctx.rect(this.startX, this.startY, pos.x - this.startX, pos.y - this.startY);
            } else if (this.tool === 'circle') {
                const radius = Math.sqrt(Math.pow(pos.x - this.startX, 2) + Math.pow(pos.y - this.startY, 2));
                // БАГФИКС: moveTo на край радиуса перед arc()
                this.ctx.moveTo(this.startX + radius, this.startY); 
                this.ctx.arc(this.startX, this.startY, radius, 0, Math.PI * 2);
            }
            this.ctx.stroke();
        }
    },

    endPos() {
        this.isDrawing = false;
        this.ctx.beginPath();
    },

    pickColor(x, y) {
        const pixel = this.ctx.getImageData(x, y, 1, 1).data;
        const hex = "#" + ((1 << 24) + (pixel[0] << 16) + (pixel[1] << 8) + pixel[2]).toString(16).slice(1);
        document.getElementById('color-picker').value = hex;
        this.setTool('pencil'); // Автовозврат на карандаш
    },

    publishArt() {
        const title = document.getElementById('art-title').value.trim() || 'Без названия';
        const dataURL = this.canvas.toDataURL('image/png'); // Белый фон гарантирует корректность
        
        db.ref('posts').push({
            author: app.currentUser,
            title: title,
            image: dataURL,
            likes: 0,
            timestamp: firebase.database.ServerValue.TIMESTAMP
        });

        document.getElementById('art-title').value = '';
        app.navigate('main-screen');
    }
};

// Запуск
window.onload = () => app.init();
        
