// Точка входа сетевой игры
import { gameState } from './gameState.js';
import { networkState, initNetworkState } from './networkState.js';
import { updateGameArea } from './gameArea.js';
import { init, animate, setupEventListeners, startNetworkGame } from './game.js';
import { createRoom, joinRoom, getRoomPlayers, subscribeToRoom, startGame } from './roomManager.js';
import { updatePlayersList, showRoomScreen, showGameScreen, updateConnectionStatus } from './ui.js';

// Инициализация сетевого состояния
initNetworkState();

// Инициализация canvas
gameState.canvas = document.getElementById('canvas1');
gameState.ctx = gameState.canvas.getContext('2d');
gameState.canvas.width = window.innerWidth;
gameState.canvas.height = window.innerHeight;

// Инициализация игровой области
updateGameArea();

// Настройка обработчиков событий
setupEventListeners();

// UI функции для комнат
window.createRoom = async function() {
    const roomName = document.getElementById('roomNameInput')?.value || 'Моя комната';
    const result = await createRoom(roomName);
    if (result.success) {
        await getRoomPlayers(result.room.id);
        updatePlayersList(networkState.connectedPlayers);
        document.getElementById('roomCode').textContent = result.room.code;
        document.getElementById('roomScreen').style.display = 'block';
        document.getElementById('menuScreen').style.display = 'none';
        document.getElementById('startGameBtn').style.display = networkState.isHost ? 'block' : 'none';
        subscribeToRoom(result.room.id, async (payload) => {
            if (payload.table === 'players') {
                await getRoomPlayers(result.room.id);
                updatePlayersList(networkState.connectedPlayers);
            }
        });
    } else {
        alert('Ошибка создания комнаты: ' + result.error);
    }
};

window.joinRoom = async function() {
    const roomCode = document.getElementById('roomCodeInput')?.value;
    if (!roomCode) {
        alert('Введите код комнаты!');
        return;
    }
    const result = await joinRoom(roomCode);
    if (result.success) {
        await getRoomPlayers(result.room.id);
        updatePlayersList(networkState.connectedPlayers);
        document.getElementById('roomCode').textContent = result.room.code;
        document.getElementById('roomScreen').style.display = 'block';
        document.getElementById('menuScreen').style.display = 'none';
        document.getElementById('startGameBtn').style.display = networkState.isHost ? 'block' : 'none';
        subscribeToRoom(result.room.id, async (payload) => {
            if (payload.table === 'players') {
                await getRoomPlayers(result.room.id);
                updatePlayersList(networkState.connectedPlayers);
            }
            if (payload.table === 'rooms' && payload.new && payload.new.status === 'playing') {
                startNetworkGame();
                showGameScreen();
            }
        });
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

