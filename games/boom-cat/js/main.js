// Точка входа игры
import { gameState } from './gameState.js';
import { updateGameArea } from './gameArea.js';
import { init, animate, setupEventListeners } from './game.js';

// Инициализация canvas
gameState.canvas = document.getElementById('canvas1');
gameState.ctx = gameState.canvas.getContext('2d');
gameState.canvas.width = window.innerWidth;
gameState.canvas.height = window.innerHeight;

// Инициализация игровой области
updateGameArea();

// Настройка обработчиков событий
setupEventListeners();

// Запуск игры
init();
animate();

