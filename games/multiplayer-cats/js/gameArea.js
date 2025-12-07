// Управление игровой областью
import { gameState } from './gameState.js';

export function updateGameArea() {
    gameState.gameArea.left = 50;
    gameState.gameArea.top = 50;
    gameState.gameArea.right = gameState.canvas.width - 50;
    gameState.gameArea.bottom = gameState.canvas.height - 50;
    gameState.gameArea.width = gameState.gameArea.right - gameState.gameArea.left;
    gameState.gameArea.height = gameState.gameArea.bottom - gameState.gameArea.top;
}

