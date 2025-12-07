// Класс игрока
import { gameState } from './gameState.js';

export class Player {
    constructor(playerId, playerName, x, y, characterType) {
        this.playerId = playerId;
        this.name = playerName;
        this.x = x;
        this.y = y;
        this.vx = 0;
        this.vy = 0;
        this.characterType = characterType; // 'cat' или 'dog'
        this.color = characterType === 'cat' ? '#ff6b6b' : '#4ecdc4';
        this.radius = 20;
        this.speed = 5;
    }

    update() {
        // Обновление позиции
        this.x += this.vx;
        this.y += this.vy;
        
        // Ограничение движения внутри игровой области
        if (gameState.gameArea.width > 0 && gameState.gameArea.height > 0) {
            this.x = Math.max(gameState.gameArea.left + this.radius, 
                            Math.min(gameState.gameArea.right - this.radius, this.x));
            this.y = Math.max(gameState.gameArea.top + this.radius, 
                            Math.min(gameState.gameArea.bottom - this.radius, this.y));
        }
    }

    draw(ctx) {
        // Рисуем круг (персонаж)
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        
        // Рисуем обводку
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Рисуем имя
        ctx.fillStyle = '#fff';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(this.name, this.x, this.y - this.radius - 5);
        
        // Иконка персонажа
        ctx.font = '16px Arial';
        ctx.fillText(this.characterType === 'cat' ? '🐱' : '🐶', this.x, this.y + 5);
    }
}

