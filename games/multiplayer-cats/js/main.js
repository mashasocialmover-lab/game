// Точка входа сетевой игры
import { gameState } from './gameState.js';
import { networkState, initNetworkState } from './networkState.js';
import { updateGameArea } from './gameArea.js';
import { init, startGameLoop, stopGame, setupEventListeners, spawnMyPlayer } from './game.js';
import { createRoom, joinRoom, getRoomPlayers, subscribeToRoom, startGame as startRoomGame, leaveRoom } from './roomManager.js';
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

// Если есть код комнаты в URL - автоматически заполняем поле
if (roomCodeFromUrl) {
    setTimeout(() => {
        const codeInput = document.getElementById('roomCodeInput');
        if (codeInput) {
            codeInput.value = roomCodeFromUrl.toUpperCase();
        }
    }, 100);
}

// Инициализация canvas
gameState.canvas = document.getElementById('gameCanvas');
gameState.ctx = gameState.canvas.getContext('2d');
gameState.canvas.width = window.innerWidth;
gameState.canvas.height = window.innerHeight;

// Инициализация игровой области
updateGameArea();

// Настройка обработчиков событий
setupEventListeners();

// Функции UI
function showScreen(screenId) {
    document.getElementById('menuScreen').style.display = 'none';
    document.getElementById('characterScreen').style.display = 'none';
    document.getElementById('roomScreen').style.display = 'none';
    document.getElementById('gameScreen').style.display = 'none';
    
    if (screenId) {
        document.getElementById(screenId).style.display = 'flex';
    }
}

function updatePlayersList() {
    const list = document.getElementById('playersList');
    if (!list) return;
    
    list.innerHTML = '';
    networkState.connectedPlayers.forEach(player => {
        const li = document.createElement('li');
        li.textContent = player.player_name + (player.is_host ? ' (Хост)' : '');
        list.appendChild(li);
    });
    
    // Обновляем счетчик в игре - показываем количество игроков в комнате
    const countEl = document.getElementById('playersCount');
    if (countEl) {
        countEl.textContent = networkState.connectedPlayers.length;
    }
}

function updateConnectionStatus() {
    const statusEl = document.getElementById('connectionStatus');
    if (!statusEl) return;
    
    if (networkState.isConnected) {
        statusEl.textContent = '🟢 Подключено';
        statusEl.style.color = '#4caf50';
    } else {
        statusEl.textContent = '🔴 Отключено';
        statusEl.style.color = '#f44336';
    }
}

// Создание комнаты
window.createRoom = async function() {
    const roomName = document.getElementById('roomNameInput')?.value || 'Моя комната';
    const playerName = document.getElementById('playerNameInput')?.value?.trim() || networkState.playerName;
    
    if (playerName) {
        networkState.playerName = playerName;
        localStorage.setItem('playerName', playerName);
    }
    
    console.log('🏠 Создание комнаты:', roomName);
    const result = await createRoom(roomName);
    if (result.success) {
        console.log('✅ Комната создана:', result.room.code);
        await getRoomPlayers(result.room.id);
        updatePlayersList();
        document.getElementById('roomCode').textContent = result.room.code;
        document.getElementById('startGameBtn').style.display = networkState.isHost ? 'block' : 'none';
        
        // Обновляем URL
        window.history.pushState({}, '', window.location.pathname + '?room=' + result.room.code);
        
        // Инициализируем игру если еще не инициализирована
        if (!gameState.canvas) {
            console.log('🎮 Инициализируем игру после создания комнаты');
            import('./game.js').then(({ init }) => {
                init();
            });
        }
        
        showScreen('characterScreen');
        updateConnectionStatus();
        
        // Подписываемся на изменения
        subscribeToRoom(result.room.id, async (payload) => {
            if (payload.table === 'players') {
                await getRoomPlayers(result.room.id);
                updatePlayersList();
            }
            if (payload.table === 'rooms' && payload.new) {
                if (payload.new.status === 'playing' && networkState.currentRoom?.status !== 'playing') {
                    networkState.currentRoom.status = 'playing';
                    if (!networkState.selectedCharacter) {
                        // Если еще не выбрали персонажа, выбираем автоматически
                        selectCharacter('cat');
                        readyToPlay();
                    } else {
                        startGame();
                        showScreen('gameScreen');
                    }
                }
            }
        });
    } else {
        alert('Ошибка создания комнаты: ' + result.error);
    }
};

// Присоединение к комнате
window.joinRoom = async function() {
    const roomCode = document.getElementById('roomCodeInput')?.value;
    const playerName = document.getElementById('playerNameInput')?.value?.trim() || networkState.playerName;
    
    if (!roomCode) {
        alert('Введите код комнаты!');
        return;
    }
    
    if (playerName) {
        networkState.playerName = playerName;
        localStorage.setItem('playerName', playerName);
    }
    
    console.log('🔗 Присоединение к комнате:', roomCode);
    const result = await joinRoom(roomCode);
    if (result.success) {
        console.log('✅ Присоединились к комнате:', result.room.code);
        await getRoomPlayers(result.room.id);
        updatePlayersList();
        document.getElementById('roomCode').textContent = result.room.code;
        document.getElementById('startGameBtn').style.display = networkState.isHost ? 'block' : 'none';
        
        // Обновляем URL
        window.history.pushState({}, '', window.location.pathname + '?room=' + result.room.code);
        
        // Инициализируем игру если еще не инициализирована
        if (!gameState.canvas) {
            console.log('🎮 Инициализируем игру после присоединения');
            import('./game.js').then(({ init }) => {
                init();
            });
        }
        
        showScreen('characterScreen');
        updateConnectionStatus();
        
        // Проверяем статус комнаты
        if (result.room.status === 'playing') {
            // Игра уже началась
            if (!networkState.selectedCharacter) {
                selectCharacter('cat');
                readyToPlay();
            }
        } else {
            // Подписываемся на изменения
            subscribeToRoom(result.room.id, async (payload) => {
                if (payload.table === 'players') {
                    await getRoomPlayers(result.room.id);
                    updatePlayersList();
                }
                if (payload.table === 'rooms' && payload.new) {
                    if (payload.new.status === 'playing' && networkState.currentRoom?.status !== 'playing') {
                        networkState.currentRoom.status = 'playing';
                        if (!networkState.selectedCharacter) {
                            selectCharacter('cat');
                            readyToPlay();
                        } else {
                            startGameLoop();
                            showScreen('gameScreen');
                        }
                    }
                }
            });
        }
    } else {
        alert('Ошибка присоединения: ' + result.error);
    }
};

// Выбор персонажа
let selectedCharacterType = null;
window.selectCharacter = function(type) {
    selectedCharacterType = type;
    document.getElementById('catOption').classList.remove('selected');
    document.getElementById('dogOption').classList.remove('selected');
    document.getElementById(type + 'Option').classList.add('selected');
    document.getElementById('readyBtn').style.display = 'block';
};

// Готов играть
window.readyToPlay = function() {
    if (!selectedCharacterType) {
        alert('Выберите персонажа!');
        return;
    }
    
    if (!networkState.currentRoom) {
        alert('Вы не в комнате!');
        return;
    }
    
    console.log('Готов играть, выбран персонаж:', selectedCharacterType);
    
    // Спавним персонажа
    spawnMyPlayer(selectedCharacterType);
    
    // Если игра уже началась, сразу переходим к игре
    if (networkState.currentRoom.status === 'playing') {
        console.log('Игра уже началась, запускаем игровой цикл');
        startGameLoop();
        showScreen('gameScreen');
    } else {
        // Показываем экран комнаты и ждем старта
        console.log('Ожидаем старта игры');
        showScreen('roomScreen');
    }
};

// Начать игру (только для хоста)
window.startGame = async function() {
    if (!networkState.isHost) {
        alert('Только хост может начать игру!');
        return;
    }
    
    const success = await startRoomGame();
    if (success) {
        // Если еще не выбрали персонажа, выбираем автоматически
        if (!networkState.selectedCharacter) {
            selectCharacter('cat');
            spawnMyPlayer('cat');
        }
        startGameLoop();
        showScreen('gameScreen');
    }
};

// Покинуть комнату
window.leaveRoom = async function() {
    await leaveRoom();
    stopGame();
    showScreen('menuScreen');
    selectedCharacterType = null;
    networkState.selectedCharacter = null;
    networkState.myPlayerId = null;
};

// Настройка обработчиков событий для кнопок
document.addEventListener('DOMContentLoaded', () => {
    // Кнопки меню
    const createRoomBtn = document.getElementById('createRoomBtn');
    const joinRoomBtn = document.getElementById('joinRoomBtn');
    
    if (createRoomBtn) {
        createRoomBtn.addEventListener('click', () => {
            if (window.createRoom) {
                window.createRoom();
            } else {
                console.error('createRoom не определена');
            }
        });
    }
    
    if (joinRoomBtn) {
        joinRoomBtn.addEventListener('click', () => {
            if (window.joinRoom) {
                window.joinRoom();
            } else {
                console.error('joinRoom не определена');
            }
        });
    }
    
    // Кнопка готов играть
    const readyBtn = document.getElementById('readyBtn');
    if (readyBtn) {
        readyBtn.addEventListener('click', () => {
            if (window.readyToPlay) {
                window.readyToPlay();
            }
        });
    }
    
    // Кнопка начать игру
    const startGameBtn = document.getElementById('startGameBtn');
    if (startGameBtn) {
        startGameBtn.addEventListener('click', () => {
            if (window.startGame) {
                window.startGame();
            }
        });
    }
    
    // Кнопки выхода
    const leaveRoomBtn = document.getElementById('leaveRoomBtn');
    const leaveGameBtn = document.getElementById('leaveGameBtn');
    
    if (leaveRoomBtn) {
        leaveRoomBtn.addEventListener('click', () => {
            if (window.leaveRoom) {
                window.leaveRoom();
            }
        });
    }
    
    if (leaveGameBtn) {
        leaveGameBtn.addEventListener('click', () => {
            if (window.leaveRoom) {
                window.leaveRoom();
            }
        });
    }
    
    // Выбор персонажа
    const catOption = document.getElementById('catOption');
    const dogOption = document.getElementById('dogOption');
    
    if (catOption) {
        catOption.addEventListener('click', () => {
            if (window.selectCharacter) {
                window.selectCharacter('cat');
            }
        });
    }
    
    if (dogOption) {
        dogOption.addEventListener('click', () => {
            if (window.selectCharacter) {
                window.selectCharacter('dog');
            }
        });
    }
});

// Инициализация игры (базовая, без комнаты)
console.log('🚀 Запуск приложения');
(async () => {
    await init();
    console.log('✅ Приложение инициализировано');
})();

// Обновление списка игроков каждую секунду (для отладки)
setInterval(() => {
    if (gameState.isPlaying) {
        updatePlayersList();
    }
}, 1000);

