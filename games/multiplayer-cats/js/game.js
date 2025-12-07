// Логика игры
import { gameState } from './gameState.js';
import { networkState } from './networkState.js';
import { updateGameArea } from './gameArea.js';
import { Player } from './Player.js';
import { syncPlayerPosition, syncPlayerSpawn, requestOtherPlayersSpawn, onGameEvent, initSync, stopSync } from './syncManager.js';
import { getRoomPlayers, subscribeToRoom } from './roomManager.js';

let animationFrameId = null;
let roomSubscription = null;

// Инициализация игры
export async function init() {
    console.log('🎮 Инициализация игры');
    updateGameArea();
    console.log('📐 Игровая область:', gameState.gameArea);
    
    if (networkState.currentRoom) {
        console.log('🏠 Есть комната, инициализируем синхронизацию');
        try {
            await initSync(networkState.currentRoom.id);
            subscribeToRoomChanges();
            setupSyncHandlers();
        } catch (error) {
            console.error('❌ Ошибка инициализации синхронизации:', error);
        }
    } else {
        console.log('ℹ️ Комнаты нет, ждем создания/присоединения');
    }
}

// Подписка на изменения в комнате
function subscribeToRoomChanges() {
    if (!networkState.currentRoom) return;
    
    roomSubscription = subscribeToRoom(networkState.currentRoom.id, async (payload) => {
        if (payload.table === 'players') {
            await getRoomPlayers(networkState.currentRoom.id);
        }
        if (payload.table === 'rooms' && payload.new) {
            if (payload.new.status === 'playing' && networkState.currentRoom.status !== 'playing') {
                networkState.currentRoom.status = 'playing';
                startGameLoop();
            }
        }
    });
}

// Настройка обработчиков синхронизации
function setupSyncHandlers() {
    console.log('🔧 Настройка обработчиков синхронизации');
    onGameEvent((event) => {
        console.log('📨 Получено игровое событие:', event.event_type, 'от', event.player_id);
        if (event.event_type === 'player_move') {
            handleRemotePlayerMove(event.event_data);
        } else if (event.event_type === 'player_spawn') {
            handleRemotePlayerSpawn(event.event_data);
        } else if (event.event_type === 'request_spawn') {
            console.log('📥 Запрос на отправку информации о нашем персонаже');
            // Запрос на отправку информации о нашем персонаже
            if (networkState.myPlayerId && gameState.players.has(networkState.myPlayerId)) {
                const myPlayer = gameState.players.get(networkState.myPlayerId);
                console.log('📤 Отправляем информацию о нашем персонаже');
                syncPlayerSpawn(
                    networkState.myPlayerId,
                    networkState.playerName,
                    myPlayer.x,
                    myPlayer.y,
                    networkState.selectedCharacter
                );
            } else {
                console.warn('⚠️ Наш персонаж еще не создан, не можем отправить информацию');
            }
        } else {
            console.log('⚠️ Неизвестный тип события:', event.event_type);
        }
    });
    console.log('✅ Обработчики синхронизации настроены');
}

// Обработка движения удаленного игрока
function handleRemotePlayerMove(data) {
    const player = gameState.players.get(data.player_id);
    if (player) {
        // Интерполяция позиции для плавности
        const lerp = 0.3;
        if (data.x !== undefined) player.x += (data.x - player.x) * lerp;
        if (data.y !== undefined) player.y += (data.y - player.y) * lerp;
        player.vx = data.vx || 0;
        player.vy = data.vy || 0;
    } else {
        // Если игрока нет, но пришло движение - возможно нужно запросить спавн
        console.log('Получено движение от неизвестного игрока:', data.player_id);
    }
}

// Обработка спавна удаленного игрока
function handleRemotePlayerSpawn(data) {
    // Игнорируем свой спавн
    if (data.player_id === networkState.playerId) return;
    
    console.log('Получен спавн удаленного игрока:', data);
    
    // Создаем игрока если его еще нет, или обновляем существующего
    if (!gameState.players.has(data.player_id)) {
        const player = new Player(
            data.player_id,
            data.player_name,
            data.x || gameState.gameArea.left + 100,
            data.y || gameState.gameArea.top + 100,
            data.character_type || 'cat'
        );
        gameState.players.set(data.player_id, player);
        console.log('Создан игрок:', data.player_id, data.player_name);
    } else {
        // Обновляем позицию существующего игрока
        const player = gameState.players.get(data.player_id);
        if (data.x !== undefined) player.x = data.x;
        if (data.y !== undefined) player.y = data.y;
    }
}

// Спавн нашего персонажа
export function spawnMyPlayer(characterType) {
    if (!networkState.currentRoom) {
        console.error('❌ Нет текущей комнаты для спавна');
        return;
    }
    
    // Случайная позиция в игровой области
    const x = gameState.gameArea.left + Math.random() * gameState.gameArea.width;
    const y = gameState.gameArea.top + Math.random() * gameState.gameArea.height;
    
    console.log('🎮 Спавн нашего персонажа:', {
        id: networkState.playerId,
        name: networkState.playerName,
        x: x.toFixed(0),
        y: y.toFixed(0),
        type: characterType
    });
    
    const player = new Player(
        networkState.playerId,
        networkState.playerName,
        x,
        y,
        characterType
    );
    
    gameState.players.set(networkState.playerId, player);
    networkState.myPlayerId = networkState.playerId;
    networkState.selectedCharacter = characterType;
    
    console.log('✅ Персонаж создан локально, игроков в игре:', gameState.players.size);
    
    // Синхронизируем спавн с другими игроками
    syncPlayerSpawn(networkState.playerId, networkState.playerName, x, y, characterType);
    
    // Запрашиваем информацию о других игроках (с небольшой задержкой для установки соединений)
    setTimeout(() => {
        console.log('📤 Запрашиваем информацию о других игроках...');
        requestOtherPlayersSpawn();
    }, 2000);
}

// Обновление игры
function update() {
    if (!gameState.isPlaying) return;
    
    // Обновляем всех игроков
    gameState.players.forEach((player) => {
        // Если это наш игрок - обрабатываем ввод
        if (player.playerId === networkState.playerId) {
            handlePlayerInput(player);
            // Синхронизируем позицию
            syncPlayerPosition(player.playerId, player.x, player.y, player.vx, player.vy);
        }
        
        player.update();
    });
}

// Обработка ввода игрока
function handlePlayerInput(player) {
    player.vx = 0;
    player.vy = 0;
    
    if (gameState.keys.KeyW) player.vy = -player.speed;
    if (gameState.keys.KeyS) player.vy = player.speed;
    if (gameState.keys.KeyA) player.vx = -player.speed;
    if (gameState.keys.KeyD) player.vx = player.speed;
    
    // Диагональное движение замедляется
    if (player.vx !== 0 && player.vy !== 0) {
        player.vx *= 0.71;
        player.vy *= 0.71;
    }
}

// Отрисовка игры
function draw() {
    const ctx = gameState.ctx;
    if (!ctx) return;
    
    // Очистка canvas
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, gameState.canvas.width, gameState.canvas.height);
    
    // Рисуем границы игровой области
    ctx.strokeStyle = '#4ecdc4';
    ctx.lineWidth = 2;
    ctx.strokeRect(
        gameState.gameArea.left,
        gameState.gameArea.top,
        gameState.gameArea.width,
        gameState.gameArea.height
    );
    
    // Рисуем всех игроков
    gameState.players.forEach((player) => {
        player.draw(ctx);
    });
}

// Игровой цикл
function gameLoop() {
    update();
    draw();
    animationFrameId = requestAnimationFrame(gameLoop);
}

// Начать игровой цикл
export function startGameLoop() {
    if (gameState.isPlaying) {
        console.log('Игра уже запущена');
        return;
    }
    
    console.log('Запуск игрового цикла, игроков:', gameState.players.size);
    gameState.isPlaying = true;
    gameLoop();
    
    // Запрашиваем информацию о других игроках после небольшой задержки
    setTimeout(() => {
        requestOtherPlayersSpawn();
        console.log('Запрошена информация о других игроках');
    }, 500);
}

// Остановить игру
export function stopGame() {
    gameState.isPlaying = false;
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }
    
    // Очищаем игроков
    gameState.players.clear();
    
    // Останавливаем синхронизацию
    stopSync();
    
    if (roomSubscription) {
        // Отписываемся от изменений
        roomSubscription = null;
    }
}

// Настройка обработчиков событий клавиатуры
export function setupEventListeners() {
    window.addEventListener('keydown', (e) => {
        if (gameState.keys.hasOwnProperty(e.code)) {
            gameState.keys[e.code] = true;
        }
    });
    
    window.addEventListener('keyup', (e) => {
        if (gameState.keys.hasOwnProperty(e.code)) {
            gameState.keys[e.code] = false;
        }
    });
    
    // Обработка изменения размера окна
    window.addEventListener('resize', () => {
        if (gameState.canvas) {
            gameState.canvas.width = window.innerWidth;
            gameState.canvas.height = window.innerHeight;
            updateGameArea();
        }
    });
}

