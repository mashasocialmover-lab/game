// Класс Мышь
import { gameState } from '../gameState.js';
import { getRandomName } from '../utils.js';
import { playSound } from '../audio.js';
import { drawHpBar } from '../ui.js';

export class Mouse {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.id = Math.random();
        this.name = getRandomName('MOUSE');
        this.markedForDeletion = false;
        this.angle = Math.random() * Math.PI * 2;
        this.speed = 13;
        this.vx = 0;
        this.vy = 0;
        this.state = 'WANDERING';
        this.frame = 0;
        this.maxHp = 1;
        this.hp = 1;
        playSound('squeak');
    }
    
    update() {
        if (gameState.isPaused) return;
        this.frame++;
        if (this.frame % 10 === 0) {
            gameState.footprints.push({x: this.x, y: this.y, angle: this.angle, life: 100, type: 'tiny'});
        }
        let nearestCat = null;
        let minDist = 250;
        gameState.catsArray.forEach(cat => {
            let d = Math.sqrt((this.x - cat.x)**2 + (this.y - cat.y)**2);
            if (d < minDist) {
                minDist = d;
                nearestCat = cat;
            }
        });
        if (nearestCat) {
            this.state = 'FLEEING';
            let angleFromCat = Math.atan2(this.y - nearestCat.y, this.x - nearestCat.x);
            angleFromCat += (Math.random() - 0.5);
            this.vx = Math.cos(angleFromCat) * this.speed;
            this.vy = Math.sin(angleFromCat) * this.speed;
        } else {
            this.state = 'WANDERING';
            if (this.frame % 10 === 0) {
                this.angle += (Math.random() - 0.5) * 1.5;
                this.vx = Math.cos(this.angle) * (this.speed * 0.6);
                this.vy = Math.sin(this.angle) * (this.speed * 0.6);
            }
        }
        this.x += this.vx;
        this.y += this.vy;
        // Ограничение движения внутри игровой области
        if (this.x < gameState.gameArea.left + 20 || this.x > gameState.gameArea.right - 20) {
            this.vx *= -1;
            this.angle += Math.PI;
        }
        if (this.y < gameState.gameArea.top + 20 || this.y > gameState.gameArea.bottom - 20) {
            this.vy *= -1;
            this.angle += Math.PI;
        }
        this.x = Math.max(gameState.gameArea.left + 20, Math.min(gameState.gameArea.right - 20, this.x));
        this.y = Math.max(gameState.gameArea.top + 20, Math.min(gameState.gameArea.bottom - 20, this.y));
        this.angle = Math.atan2(this.vy, this.vx);
    }
    
    draw() {
        const ctx = gameState.ctx;
        ctx.save();
        ctx.translate(this.x, this.y);
        drawHpBar(ctx, this.hp, this.maxHp);
        ctx.fillStyle = '#fff';
        ctx.font = '10px Arial';
        ctx.textAlign = 'center';
        ctx.strokeStyle = 'black';
        ctx.lineWidth = 2;
        ctx.strokeText(this.name, 0, -10);
        ctx.fillText(this.name, 0, -10);
        ctx.rotate(this.angle + Math.PI/2);
        ctx.beginPath();
        ctx.moveTo(0, 5);
        ctx.quadraticCurveTo(Math.sin(this.frame*0.8)*5, 15, 0, 25);
        ctx.strokeStyle = 'pink';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = '#aaa';
        ctx.beginPath();
        ctx.ellipse(0, 0, 6, 10, 0, 0, Math.PI*2);
        ctx.fill();
        ctx.fillStyle = 'pink';
        ctx.beginPath();
        ctx.arc(-5, -5, 4, 0, Math.PI*2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(5, -5, 4, 0, Math.PI*2);
        ctx.fill();
        ctx.restore();
    }
}

