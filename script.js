document.addEventListener('DOMContentLoaded', () => {
    // --- Элементы DOM ---
    const loginScreen = document.getElementById('login-screen');
    const mainScreen = document.getElementById('main-screen');
    const editorScreen = document.getElementById('editor-screen');

    const nicknameInput = document.getElementById('nickname-input');
    const loginButton = document.getElementById('login-button');
    const nicknameError = document.getElementById('nickname-error');
    
    const currentUserNickname = document.getElementById('current-user-nickname');
    const drawButton = document.getElementById('draw-button');
    const galleryContainer = document.getElementById('gallery-container');

    const canvas = document.getElementById('paint-canvas');
    const ctx = canvas.getContext('2d');
    
    // --- Инструменты редактора ---
    const toolBtns = document.querySelectorAll('.tool-btn');
    const colorPicker = document.getElementById('color-picker');
    const lineWidthSlider = document.getElementById('line-width');
    const lineWidthValue = document.getElementById('line-width-value');
    const fillCanvasBtn = document.getElementById('fill-canvas-btn');
    const publishButton = document.getElementById('publish-button');
    const backToGalleryButton = document.getElementById('back-to-gallery-button');

    // --- Переменные состояния ---
    let currentUser = null;
    let users = JSON.parse(localStorage.getItem('bitpaint_users')) || [];
    let drawings = JSON.parse(localStorage.getItem('bitpaint_drawings')) || [];

    let isDrawing = false;
    let isErasing = false;
    let currentTool = 'pencil';
    let lastX, lastY;
    let startX, startY;
    let snapshot;

    // --- Инициализация ---
    
    // Проверяем, был ли пользователь уже залогинен
    const lastUser = localStorage.getItem('bitpaint_lastUser');
    if (lastUser) {
        currentUser = lastUser;
        showScreen('main');
    } else {
        showScreen('login');
    }

    // --- Управление экранами ---
    function showScreen(screenName) {
        loginScreen.classList.remove('active');
        mainScreen.classList.remove('active');
        editorScreen.classList.remove('active');

        if (screenName === 'login') {
            loginScreen.classList.add('active');
        } else if (screenName === 'main') {
            currentUserNickname.textContent = currentUser;
            renderGallery();
            mainScreen.classList.add('active');
        } else if (screenName === 'editor') {
            editorScreen.classList.add('active');
            // Устанавливаем размер холста при переходе в редактор
            setTimeout(setupCanvas, 50); 
        }
    }

    // --- Логика входа ---
    loginButton.addEventListener('click', () => {
        const nickname = nicknameInput.value.trim();
        if (!nickname) {
            nicknameError.textContent = 'Ник не может быть пустым.';
            return;
        }
        if (users.includes(nickname)) {
            nicknameError.textContent = 'Этот ник уже используется.';
            return;
        }

        // Если это новый пользователь, добавляем его
        users.push(nickname);
        localStorage.setItem('bitpaint_users', JSON.stringify(users));

        currentUser = nickname;
        localStorage.setItem('bitpaint_lastUser', currentUser);
        showScreen('main');
    });

    drawButton.addEventListener('click', () => showScreen('editor'));
    backToGalleryButton.addEventListener('click', () => showScreen('main'));

    // --- Настройка Холста ---
    function setupCanvas() {
        const editorContainer = document.querySelector('.editor-container');
        canvas.width = editorContainer.offsetWidth;
        canvas.height = editorContainer.offsetHeight - document.querySelector('.toolbar').offsetHeight;
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = colorPicker.value;
        ctx.lineWidth = lineWidthSlider.value;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
    }

    // --- Логика Рисования (Универсальная для мыши и касаний) ---
    function getCoords(e) {
        const rect = canvas.getBoundingClientRect();
        if (e.touches) { // Для мобильных устройств
            return {
                x: e.touches[0].clientX - rect.left,
                y: e.touches[0].clientY - rect.top
            };
        }
        // Для мыши
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    }

    function startDrawing(e) {
        e.preventDefault();
        isDrawing = true;
        const coords = getCoords(e);
        [lastX, lastY] = [coords.x, coords.y];
        [startX, startY] = [coords.x, coords.y];
        
        // Сохраняем текущее состояние холста для фигур
        snapshot = ctx.getImageData(0, 0, canvas.width, canvas.height);
        
        if (currentTool === 'text') {
            const text = prompt("Введите текст:");
            if (text) {
                ctx.fillStyle = colorPicker.value;
                ctx.font = `${lineWidthSlider.value * 2}px sans-serif`;
                ctx.fillText(text, coords.x, coords.y);
            }
            isDrawing = false;
        }
    }

    function draw(e) {
        if (!isDrawing) return;
        e.preventDefault();
        
        const coords = getCoords(e);
        ctx.strokeStyle = (currentTool === 'eraser') ? '#FFFFFF' : colorPicker.value;
        
        switch (currentTool) {
            case 'pencil':
            case 'eraser':
                ctx.beginPath();
                ctx.moveTo(lastX, lastY);
                ctx.lineTo(coords.x, coords.y);
                ctx.stroke();
                [lastX, lastY] = [coords.x, coords.y];
                break;
            case 'line':
            case 'rect':
            case 'circle':
                drawShape(coords.x, coords.y);
                break;
        }
    }
    
    function stopDrawing() {
        if (!isDrawing) return;
        isDrawing = false;
        ctx.beginPath(); // Сбрасываем путь
    }

    function drawShape(currentX, currentY) {
        ctx.putImageData(snapshot, 0, 0); // Восстанавливаем холст
        ctx.beginPath();
        
        switch(currentTool) {
            case 'line':
                ctx.moveTo(startX, startY);
                ctx.lineTo(currentX, currentY);
                break;
            case 'rect':
                ctx.strokeRect(startX, startY, currentX - startX, currentY - startY);
                break;
            case 'circle':
                let radius = Math.sqrt(Math.pow(currentX - startX, 2) + Math.pow(currentY - startY, 2));
                ctx.arc(startX, startY, radius, 0, 2 * Math.PI);
                break;
        }
        ctx.stroke();
    }
    
    // --- Слушатели событий холста ---
    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseout', stopDrawing);

    canvas.addEventListener('touchstart', startDrawing, { passive: false });
    canvas.addEventListener('touchmove', draw, { passive: false });
    canvas.addEventListener('touchend', stopDrawing);

    window.addEventListener('resize', setupCanvas);

    // --- Управление инструментами ---
    toolBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelector('.tool-btn.active').classList.remove('active');
            btn.classList.add('active');
            currentTool = btn.dataset.tool;
        });
    });

    lineWidthSlider.addEventListener('input', (e) => {
        ctx.lineWidth = e.target.value;
        lineWidthValue.textContent = e.target.value;
    });

    colorPicker.addEventListener('change', (e) => {
        ctx.strokeStyle = e.target.value;
        ctx.fillStyle = e.target.value;
    });

    fillCanvasBtn.addEventListener('click', () => {
        ctx.fillStyle = colorPicker.value;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    });

    // --- Публикация, Лайки, Комментарии ---
    publishButton.addEventListener('click', () => {
        const imageURL = canvas.toDataURL('image/png');
        const newDrawing = {
            id: Date.now(),
            author: currentUser,
            image: imageURL,
            likes: [],
            comments: []
        };
        drawings.unshift(newDrawing); // Добавляем в начало массива
        localStorage.setItem('bitpaint_drawings', JSON.stringify(drawings));
        alert('Рисунок опубликован!');
        showScreen('main');
    });
    
    function renderGallery() {
        galleryContainer.innerHTML = '';
        drawings.forEach(drawing => {
            const card = document.createElement('div');
            card.className = 'drawing-card';

            const isLiked = drawing.likes.includes(currentUser);

            card.innerHTML = `
                <img src="${drawing.image}" alt="Рисунок от ${drawing.author}">
                <div class="card-info">
                    <span class="author-nick">@${drawing.author}</span>
                    <div class="like-section">
                        <button class="like-btn ${isLiked ? 'liked' : ''}" data-id="${drawing.id}">
                            <i class="fas fa-heart"></i>
                        </button>
                        <span class="like-count">${drawing.likes.length}</span>
                    </div>
                </div>
                <div class="card-comments-section">
                    <div class="comments-list">
                        ${drawing.comments.map(c => `<div class="comment"><strong>@${c.author}:</strong> ${c.text}</div>`).join('')}
                    </div>
                    <form class="comment-input-form" data-id="${drawing.id}">
                        <input type="text" class="comment-input" placeholder="Добавить комментарий...">
                        <button type="submit">Отправить</button>
                    </form>
                </div>
            `;
            galleryContainer.appendChild(card);
        });

        // Добавляем обработчики событий после рендеринга
        addCardEventListeners();
    }
    
    function addCardEventListeners() {
        document.querySelectorAll('.like-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const drawingId = e.currentTarget.dataset.id;
                toggleLike(parseInt(drawingId));
            });
        });

        document.querySelectorAll('.comment-input-form').forEach(form => {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                const drawingId = e.currentTarget.dataset.id;
                const input = e.currentTarget.querySelector('.comment-input');
                const commentText = input.value.trim();
                if (commentText) {
                    addComment(parseInt(drawingId), commentText);
                    input.value = '';
                }
            });
        });
    }

    function toggleLike(drawingId) {
        const drawing = drawings.find(d => d.id === drawingId);
        if (!drawing) return;

        const likeIndex = drawing.likes.indexOf(currentUser);
        if (likeIndex > -1) {
            drawing.likes.splice(likeIndex, 1); // Убираем лайк
        } else {
            drawing.likes.push(currentUser); // Ставим лайк
        }

        localStorage.setItem('bitpaint_drawings', JSON.stringify(drawings));
        renderGallery(); // Перерисовываем галерею для обновления UI
    }

    function addComment(drawingId, text) {
        const drawing = drawings.find(d => d.id === drawingId);
        if (!drawing) return;
        
        drawing.comments.push({
            author: currentUser,
            text: text
        });

        localStorage.setItem('bitpaint_drawings', JSON.stringify(drawings));
        renderGallery();
    }
});
          
