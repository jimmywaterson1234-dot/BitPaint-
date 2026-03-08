:root {
    --bg-color: #0b0b14;
    --primary-neon: #8a2be2;
    --highlight-neon: #b967ff;
    --accent-neon: #c084fc;
    --text-color: #ffffff;
    --secondary-text: #e0cffc;
    --card-bg: #1a1a2e;
    --border-color: #3a2c5c;
}

body {
    font-family: 'Roboto', sans-serif;
    background-color: var(--bg-color);
    color: var(--text-color);
    margin: 0;
    padding: 0;
    overflow-x: hidden;
}

.screen { display: none; flex-direction: column; align-items: center; justify-content: flex-start; min-height: 100vh; width: 100%; animation: fadeIn 0.4s ease-in-out; }
.screen.active { display: flex; }

@keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

/* Вход */
#login-screen { justify-content: center; }
.login-container { text-align: center; background: var(--card-bg); padding: 40px; border-radius: 15px; box-shadow: 0 0 25px rgba(138, 43, 226, 0.4); border: 1px solid var(--primary-neon); }
.login-container h1 { color: var(--accent-neon); text-shadow: 0 0 10px var(--primary-neon); }
#nickname-input { width: 80%; padding: 12px; margin: 20px 0; border-radius: 8px; border: 1px solid var(--border-color); background: var(--bg-color); color: var(--text-color); font-size: 16px; transition: all 0.3s; }
#nickname-input:focus { outline: none; border-color: var(--primary-neon); box-shadow: 0 0 15px var(--primary-neon); }
.error-message { color: #ff4d4d; height: 20px; }

/* Кнопки */
button { background: transparent; border: 2px solid var(--primary-neon); color: var(--secondary-text); padding: 10px 20px; font-size: 16px; border-radius: 8px; cursor: pointer; transition: all 0.3s ease; text-shadow: 0 0 5px var(--primary-neon); }
button:hover { background: var(--primary-neon); color: var(--text-color); transform: scale(1.05); box-shadow: 0 0 20px var(--primary-neon); }
.icon-button { border: none; box-shadow: none; text-shadow: none; padding: 10px; }
.icon-button:hover { background: transparent; color: var(--highlight-neon); transform: translateX(-5px); box-shadow: none; }

/* Хедер */
header { width: 100%; display: flex; justify-content: space-between; align-items: center; padding: 15px 30px; background: var(--card-bg); box-shadow: 0 2px 15px rgba(138, 43, 226, 0.2); box-sizing: border-box;}
.logo { font-size: 24px; font-weight: bold; color: var(--accent-neon); text-shadow: 0 0 10px var(--primary-neon); }
.user-info { display: flex; align-items: center; gap: 20px; }

/* Кликабельные ники */
.clickable-nick { font-weight: bold; color: var(--accent-neon); cursor: pointer; transition: color 0.3s, text-shadow 0.3s; }
.clickable-nick:hover { color: var(--text-color); text-shadow: 0 0 10px var(--highlight-neon); text-decoration: underline; }
.current-user-nick { font-size: 18px; border-bottom: 1px dashed var(--primary-neon); }

/* ПРОФИЛЬ (Новое) */
.profile-top-bar { justify-content: flex-start; background: transparent; box-shadow: none; }
.profile-header-card { display: flex; align-items: center; gap: 30px; background: var(--card-bg); padding: 30px; width: 90%; max-width: 800px; border-radius: 15px; border: 1px solid var(--primary-neon); box-shadow: 0 0 20px rgba(138, 43, 226, 0.3); margin-top: 10px; flex-wrap: wrap;}
.profile-avatar-container img { width: 120px; height: 120px; border-radius: 50%; border: 3px solid var(--highlight-neon); box-shadow: 0 0 15px var(--primary-neon); object-fit: cover; background: var(--bg-color); }
.profile-info h2 { margin: 0 0 10px 0; color: var(--text-color); font-size: 32px; text-shadow: 0 0 10px var(--primary-neon); }
.profile-stats { display: flex; gap: 20px; color: var(--secondary-text); font-size: 16px; }
.profile-stats i { color: var(--highlight-neon); }
#edit-avatar-button { margin-left: auto; background: var(--bg-color); }
.profile-gallery-title { width: 90%; max-width: 800px; margin-top: 40px; color: var(--secondary-text); text-align: left; font-size: 24px; border-bottom: 2px solid var(--border-color); padding-bottom: 10px; }

/* Галерея */
.gallery-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 30px; padding: 30px; width: 100%; max-width: 1200px; box-sizing: border-box; }
.drawing-card { background: var(--card-bg); border-radius: 10px; border: 1px solid var(--border-color); overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.5); transition: transform 0.3s; }
.drawing-card:hover { transform: translateY(-5px); box-shadow: 0 0 20px rgba(138, 43, 226, 0.4); border-color: var(--primary-neon); }
.drawing-card img { width: 100%; height: auto; background-color: white; aspect-ratio: 16/9; object-fit: contain; }
.card-info, .card-comments-section { padding: 15px; }
.card-info { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-color); }
.like-section { display: flex; align-items: center; gap: 8px; }
.like-btn { background: none; border: none; color: var(--secondary-text); font-size: 20px; cursor: pointer; padding: 0; box-shadow: none; text-shadow: none; transition: transform 0.2s; }
.like-btn:hover { transform: scale(1.3); background: none; }
.like-btn.liked { color: #ff3366; text-shadow: 0 0 10px #ff3366; }
.comments-list { max-height: 120px; overflow-y: auto; margin-bottom: 10px; font-size: 14px; }
.comment { margin-bottom: 5px; }
.comment-input-form { display: flex; gap: 10px; }
.comment-input { flex-grow: 1; background: var(--bg-color); border: 1px solid var(--border-color); border-radius: 5px; padding: 8px; color: white; }
.comment-input-form button { padding: 8px 15px; font-size: 14px; }

/* Редактор */
#editor-screen { height: 100vh; overflow: hidden; }
.editor-container { display: flex; flex-direction: column; width: 100%; height: 100%; }
.toolbar { display: flex; flex-wrap: wrap; gap: 10px; padding: 10px; background-color: var(--card-bg); align-items: center; border-bottom: 1px solid var(--primary-neon); }
.tool-group { display: flex; align-items: center; gap: 5px; padding: 5px 10px; background: #0b0b14; border-radius: 8px; }
.right-align { margin-left: auto; background: transparent; }
.tool-btn { padding: 8px; font-size: 18px; width: 40px; height: 40px; border: 2px solid transparent; }
.tool-btn.active { border-color: var(--primary-neon); box-shadow: 0 0 10px var(--primary-neon); }
#color-picker { appearance: none; width: 30px; height: 30px; background: transparent; border: none; cursor: pointer; }
#color-picker::-webkit-color-swatch { border-radius: 50%; border: 2px solid var(--secondary-text); }
.color-label, .width-label { color: var(--secondary-text); font-size: 18px; cursor: pointer; }
#paint-canvas { background-color: white; flex-grow: 1; cursor: crosshair; touch-action: none; }

/* Адаптация для мобилок */
@media (max-width: 768px) {
    .profile-header-card { flex-direction: column; text-align: center; padding: 20px; }
    #edit-avatar-button { margin-left: 0; width: 100%; }
    .toolbar { justify-content: center; overflow-y: auto; max-height: 150px;}
    .right-align { margin-left: 0; }
    }
