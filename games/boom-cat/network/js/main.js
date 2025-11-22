// Точка входа сетевой игры
import { gameState } from './gameState.js';
import { networkState, initNetworkState } from './networkState.js';
import { updateGameArea } from './gameArea.js';
import { init, animate, setupEventListeners, startNetworkGame, createFixedItemsForClient } from './game.js';
import { createRoom, joinRoom, getRoomPlayers, subscribeToRoom, startGame, archiveEmptyRooms, updatePlayerName } from './roomManager.js';
import { updatePlayersList, showRoomScreen, showGameScreen, updateConnectionStatus } from './ui.js';
import { supabase } from './supabaseClient.js';

// Инициализация сетевого состояния
initNetworkState();

// Проверка URL параметров для автоматического присоединения
let urlParams = new URLSearchParams(window.location.search);
let roomCodeFromUrl = urlParams.get('room');

// Установка имени игрока в поле ввода
if (document.getElementById('playerNameInput')) {
    document.getElementById('playerNameInput').value = networkState.playerName;
}

// Если есть код комнаты в URL - скрываем создание комнаты
if (roomCodeFromUrl) {
    const createSection = document.getElementById('createRoomSection');
    if (createSection) {
        createSection.style.display = 'none';
    }
    // Автоматически заполняем поле кода
    setTimeout(() => {
        const codeInput = document.getElementById('roomCodeInput');
        if (codeInput) {
            codeInput.value = roomCodeFromUrl.toUpperCase();
        }
    }, 100);
}

// Периодическая архивация пустых комнат (каждые 2 минуты)
setInterval(() => {
    archiveEmptyRooms();
}, 2 * 60 * 1000);

// Инициализация canvas
gameState.canvas = document.getElementById('canvas1');
gameState.ctx = gameState.canvas.getContext('2d');
gameState.canvas.width = window.innerWidth;
gameState.canvas.height = window.innerHeight;

// Инициализация игровой области
updateGameArea();

// Настройка обработчиков событий
setupEventListeners();

// Копирование ссылки на комнату
window.copyRoomLink = function() {
    const roomCode = networkState.currentRoom?.code || document.getElementById('roomCode')?.textContent || document.getElementById('roomCodeDisplay')?.textContent;
    if (!roomCode) return;
    
    const link = window.location.origin + window.location.pathname + '?room=' + roomCode;
    
    navigator.clipboard.writeText(link).then(() => {
        alert('Ссылка скопирована: ' + link);
    }).catch(() => {
        // Fallback для старых браузеров
        const textArea = document.createElement('textarea');
        textArea.value = link;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        alert('Ссылка скопирована: ' + link);
    });
};

// Изменение имени игрока
window.changePlayerName = async function() {
    const newName = document.getElementById('playerNameInput')?.value?.trim();
    if (!newName || newName.length < 2) {
        alert('Имя должно быть не менее 2 символов!');
        return;
    }
    
    if (networkState.currentRoom) {
        const success = await updatePlayerName(newName);
        if (success) {
            await getRoomPlayers(networkState.currentRoom.id);
            updatePlayersList(networkState.connectedPlayers);
            alert('Имя изменено на: ' + newName);
        } else {
            alert('Ошибка изменения имени');
        }
    } else {
        networkState.playerName = newName;
        localStorage.setItem('playerName', newName);
        alert('Имя сохранено: ' + newName);
    }
};

// UI функции для комнат
window.createRoom = async function() {
    const roomName = document.getElementById('roomNameInput')?.value || 'Моя комната';
    const result = await createRoom(roomName);
    if (result.success) {
        await getRoomPlayers(result.room.id);
        updatePlayersList(networkState.connectedPlayers);
        const roomCode = result.room.code;
        document.getElementById('roomCode').textContent = roomCode;
        document.getElementById('roomCodeDisplay').textContent = roomCode;
        document.getElementById('roomCodeHeader').style.display = 'block';
        document.getElementById('roomScreen').style.display = 'block';
        document.getElementById('menuScreen').style.display = 'none';
        document.getElementById('startGameBtn').style.display = networkState.isHost ? 'block' : 'none';
        
        // Обновляем URL без перезагрузки
        window.history.pushState({}, '', window.location.pathname + '?room=' + roomCode);
        
        subscribeToRoom(result.room.id, async (payload) => {
            if (payload.table === 'players') {
                await getRoomPlayers(result.room.id);
                updatePlayersList(networkState.connectedPlayers);
            }
            // Проверка изменения статуса комнаты
            if (payload.table === 'rooms' && payload.new) {
                const newStatus = payload.new.status;
                if (newStatus === 'playing' && networkState.currentRoom?.status !== 'playing') {
                    startNetworkGame();
                    showGameScreen();
                }
            }
        });
        
        // Периодическая проверка статуса (на случай если подписка не сработала)
        const statusCheckInterval = setInterval(async () => {
            if (!networkState.currentRoom) {
                clearInterval(statusCheckInterval);
                return;
            }
            const { data } = await supabase
                .from('rooms')
                .select('status')
                .eq('id', networkState.currentRoom.id)
                .single();
            if (data && data.status === 'playing' && networkState.currentRoom.status !== 'playing') {
                networkState.currentRoom.status = 'playing';
                startNetworkGame();
                showGameScreen();
                clearInterval(statusCheckInterval);
            }
        }, 1000);
    } else {
        alert('Ошибка создания комнаты: ' + result.error);
    }
};

window.joinRoom = async function() {
    // Обновляем параметры URL на случай если они изменились
    urlParams = new URLSearchParams(window.location.search);
    roomCodeFromUrl = urlParams.get('room');
    const roomCode = document.getElementById('roomCodeInput')?.value || roomCodeFromUrl;
    if (!roomCode) {
        alert('Введите код комнаты!');
        return;
    }
    const result = await joinRoom(roomCode);
    if (result.success) {
        await getRoomPlayers(result.room.id);
        updatePlayersList(networkState.connectedPlayers);
        const code = result.room.code;
        document.getElementById('roomCode').textContent = code;
        document.getElementById('roomCodeDisplay').textContent = code;
        document.getElementById('roomCodeHeader').style.display = 'block';
        document.getElementById('roomScreen').style.display = 'block';
        document.getElementById('menuScreen').style.display = 'none';
        document.getElementById('startGameBtn').style.display = networkState.isHost ? 'block' : 'none';
        
        // Обновляем URL без перезагрузки
        window.history.pushState({}, '', window.location.pathname + '?room=' + code);
        
        // Проверяем текущий статус комнаты
        if (result.room.status === 'playing') {
            // Игра уже началась, сразу переходим
            // Создаем предметы локально (с тем же seed что у хоста)
            createFixedItemsForClient();
            startNetworkGame();
            showGameScreen();
        } else {
            // Подписываемся на изменения
            subscribeToRoom(result.room.id, async (payload) => {
                if (payload.table === 'players') {
                    await getRoomPlayers(result.room.id);
                    updatePlayersList(networkState.connectedPlayers);
                }
                // Проверка изменения статуса комнаты
                if (payload.table === 'rooms' && payload.new) {
                    const newStatus = payload.new.status;
                    if (newStatus === 'playing' && networkState.currentRoom?.status !== 'playing') {
                        networkState.currentRoom.status = 'playing';
                        // Создаем предметы перед стартом игры
                        if (!networkState.isHost && gameState.particleArray.length === 0) {
                            createFixedItemsForClient();
                        }
                        startNetworkGame();
                        showGameScreen();
                    }
                }
            });
            
            // Периодическая проверка статуса (на случай если подписка не сработала)
            const statusCheckInterval = setInterval(async () => {
                if (!networkState.currentRoom) {
                    clearInterval(statusCheckInterval);
                    return;
                }
                const { data } = await supabase
                    .from('rooms')
                    .select('status')
                    .eq('id', networkState.currentRoom.id)
                    .single();
                if (data && data.status === 'playing' && networkState.currentRoom.status !== 'playing') {
                    networkState.currentRoom.status = 'playing';
                    // Создаем предметы перед стартом игры
                    if (!networkState.isHost && gameState.particleArray.length === 0) {
                        createFixedItemsForClient();
                    }
                    startNetworkGame();
                    showGameScreen();
                    clearInterval(statusCheckInterval);
                }
            }, 1000);
        }
    } else {
        alert('Ошибка присоединения: ' + result.error);
    }
};

window.startGame = async function() {
    if (!networkState.isHost) {
        alert('Только хост может начать игру!');
        return;
    }
    const success = await startGame();
    if (success) {
        startNetworkGame();
        showGameScreen();
    }
};

// Запуск игры
init();
animate();

