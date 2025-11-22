// Управление игровой областью
import { gameState } from './gameState.js';

export function updateGameArea() {
    const instructionsHeight = document.getElementById('instructions').offsetHeight;
    gameState.gameArea.top = instructionsHeight + 50;
    gameState.gameArea.bottom = gameState.canvas.height - 50;
    gameState.gameArea.right = gameState.canvas.width - 100;
    gameState.gameArea.width = gameState.gameArea.right - gameState.gameArea.left;
    gameState.gameArea.height = gameState.gameArea.bottom - gameState.gameArea.top;
}

