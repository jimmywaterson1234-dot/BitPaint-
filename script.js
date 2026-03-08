document.addEventListener('DOMContentLoaded', () => {
    // --- 1. ИНИЦИАЛИЗАЦИЯ FIREBASE ---
    // Используем вашу ссылку на базу данных
    const firebaseConfig = {
        databaseURL: "https://bitpaint-f7dbd-default-rtdb.firebaseio.com"
        // Примечание: для полноценной работы на реальном сервере сюда нужно будет 
        // добавить apiKey и projectId из настроек Firebase, но для локального теста базы этого часто достаточно.
    };
    
    // Запускаем Firebase
    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    }
    const db = firebase.database();

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
    
    // Инструменты
    const toolBtns = document.querySelectorAll('.tool-btn');
    const colorPicker = document.getElementById('color-picker');
    const lineWidthSlider = document.getElementById('line-width');
    const lineWidthValue = document.getElementById('line-width-value');
    const fillCanvasBtn = document.getElementById('fill-canvas-btn');
    const publishButton = document.getElementById('publish-button');
    const backToGalleryButton = document.getElementById('back-to-gallery-button');

    // Переменные состояния
    let currentUser = localStorage.getItem('bitpaint_currentUser'); 
    let isDrawing = false;
    let currentTool = 'pencil';
    let lastX, lastY, startX, startY;
    let snapshotImg;

    // --- 2. ЛОГИКА ВХОДА И УПРАВЛЕНИЕ ЭКРАНАМИ ---
    
    if (currentUser) {
        showScreen('main');
    } else {
        showScreen('login');
    }

    loginButton.addEventListener('click', () => {
        const nickname = nicknameInput.value.trim();
        if (!nickname) {
            nicknameError.textContent = 'Ник не может быть пустым.';
            return;
        }

        // Проверяем, есть ли пользователь в БД
        db.ref('users/' + nickname).once('value', (snapshot) => {
            if (snapshot.exists() && localStorage.getItem('bitpaint_currentUser') !== nickname) {
                 nicknameError.textContent = 'Этот ник уже кем-то занят.';
            } else {
                 // Сохраняем нового пользователя
                 db.ref('users/' + nickname).set(true);
                 currentUser = nickname;
                 localStorage.setItem('bitpaint_currentUser', currentUser);
                 showScreen('main');
            }
        });
    });

    drawButton.addEventListener('click', () => showScreen('editor'));
    backToGalleryButton.addEventListener('click', () => showScreen('main'));

    function showScreen(screenName) {
        loginScreen.classList.remove('active');
        mainScreen.classList.remove('active');
        editorScreen.classList.remove('active');

        if (screenName === 'login') {
            loginScreen.classList.add('active');
        } else if (screenName === 'main') {
            currentUserNickname.textContent = currentUser;
            mainScreen.classList.add('active');
            // При переходе на главный экран начинаем слушать базу данных
            listenForDrawings(); 
        } else if (screenName === 'editor') {
            editorScreen.classList.add('active');
            setTimeout(setupCanvas, 50); 
        }
    }

    // --- 3. МАГИЯ РЕАЛЬНОГО ВРЕМЕНИ (FIREBASE LISTENERS) ---
    
    function listenForDrawings() {
        // .on('value') срабатывает КАЖДЫЙ раз, когда кто-то добавляет рисунок, ставит лайк или пишет коммент
        db.ref('drawings').on('value', (snapshot) => {
            galleryContainer.innerHTML = ''; // Очищаем галерею
            
            const drawings = [];
            // Перебираем данные из базы
            snapshot.forEach((childSnapshot) => {
                const drawing = childSnapshot.val();
                drawing.id = childSnapshot.key; // Уникальный ID из Firebase
                
                // Firebase хранит лайки/комменты как объекты, превращаем в массивы для удобства
                drawing.likesList = drawing.likes ? Object.keys(drawing.likes) : [];
                drawing.commentsList = drawing.comments ? Object.values(drawing.comments) : [];
                
                drawings.push(drawing);
            });

            // Сортируем так, чтобы новые были сверху
            drawings.sort((a, b) => b.timestamp - a.timestamp);

            // Отрисовываем карточки
            drawings.forEach(renderDrawingCard);
            addCardEventListeners();
        });
    }

    function renderDrawingCard(drawing) {
        const card = document.createElement('div');
        card.className = 'drawing-card';
        card.dataset.id = drawing.id;
        
        const isLiked = drawing.likesList.includes(currentUser);

        card.innerHTML = `
            <img src="${drawing.image}" alt="Рисунок от ${drawing.author}">
            <div class="card-info">
                <span class="author-nick">@${drawing.author}</span>
                <div class="like-section">
                    <button class="like-btn ${isLiked ? 'liked' : ''}">
                        <i class="fas fa-heart"></i>
                    </button>
                    <span class="like-count">${drawing.likesList.length}</span>
                </div>
            </div>
            <div class="card-comments-section">
                <div class="comments-list">
                    ${drawing.commentsList.map(c => `<div class="comment"><strong>@${c.author}:</strong> ${c.text}</div>`).join('')}
                </div>
                <form class="comment-input-form">
                    <input type="text" class="comment-input" placeholder="Добавить комментарий...">
                    <button type="submit">Отправить</button>
                </form>
            </div>
        `;
        galleryContainer.appendChild(card);
    }

    function addCardEventListeners() {
        document.querySelectorAll('.drawing-card').forEach(card => {
            const drawingId = card.dataset.id;
            
            // Обработка клика по лайку
            card.querySelector('.like-btn').addEventListener('click', () => {
                const likeRef = db.ref(`drawings/${drawingId}/likes/${currentUser}`);
                likeRef.once('value', snapshot => {
                    if (snapshot.exists()) {
                        likeRef.remove(); // Если лайк был - убираем
                    } else {
                        likeRef.set(true); // Если нет - ставим
                    }
                });
            });

            // Обработка отправки комментария
            card.querySelector('.comment-input-form').addEventListener('submit', (e) => {
                e.preventDefault();
                const input = e.currentTarget.querySelector('.comment-input');
                const commentText = input.value.trim();
                
                if (commentText) {
                    db.ref(`drawings/${drawingId}/comments`).push({
                        author: currentUser,
                        text: commentText,
                        timestamp: firebase.database.ServerValue.TIMESTAMP
                    });
                    input.value = '';
                }
            });
        });
    }

    // --- 4. ПУБЛИКАЦИЯ В БАЗУ ---
    publishButton.addEventListener('click', () => {
        publishButton.disabled = true;
        publishButton.textContent = 'Публикация...';

        const imageURL = canvas.toDataURL('image/png'); // Получаем картинку как текст
        
        // Отправляем в Firebase
        db.ref('drawings').push({
            author: currentUser,
            image: imageURL,
            timestamp: firebase.database.ServerValue.TIMESTAMP
        }).then(() => {
            publishButton.disabled = false;
            publishButton.innerHTML = '<i class="fas fa-upload"></i> Опубликовать';
            alert('Рисунок опубликован!');
            showScreen('main');
        });
    });

    // --- 5. ЛОГИКА РИСОВАНИЯ (БЕЗ ИЗМЕНЕНИЙ) ---
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

    function getCoords(e) {
        const rect = canvas.getBoundingClientRect();
        if (e.touches) { 
            return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
        }
        return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }

    function startDrawing(e) {
        e.preventDefault();
        isDrawing = true;
        const coords = getCoords(e);
        [lastX, lastY] = [coords.x, coords.y];
        [startX, startY] = [coords.x, coords.y];
        
        snapshotImg = ctx.getImageData(0, 0, canvas.width, canvas.height);
        
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
        
        if (['pencil', 'eraser'].includes(currentTool)) {
            ctx.beginPath();
            ctx.moveTo(lastX, lastY);
            ctx.lineTo(coords.x, coords.y);
            ctx.stroke();
            [lastX, lastY] = [coords.x, coords.y];
        } else {
            drawShape(coords.x, coords.y);
        }
    }
    
    function stopDrawing() {
        if (!isDrawing) return;
        isDrawing = false;
        ctx.beginPath(); 
    }

    function drawShape(currentX, currentY) {
        ctx.putImageData(snapshotImg, 0, 0); 
        ctx.beginPath();
        if (currentTool === 'line') {
            ctx.moveTo(startX, startY);
            ctx.lineTo(currentX, currentY);
        } else if (currentTool === 'rect') {
            ctx.strokeRect(startX, startY, currentX - startX, currentY - startY);
        } else if (currentTool === 'circle') {
            let radius = Math.sqrt(Math.pow(currentX - startX, 2) + Math.pow(currentY - startY, 2));
            ctx.arc(startX, startY, radius, 0, 2 * Math.PI);
        }
        ctx.stroke();
    }
    
    // События холста
    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseout', stopDrawing);

    canvas.addEventListener('touchstart', startDrawing, { passive: false });
    canvas.addEventListener('touchmove', draw, { passive: false });
    canvas.addEventListener('touchend', stopDrawing);
    window.addEventListener('resize', setupCanvas);

    // Управление инструментами
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
});
            
