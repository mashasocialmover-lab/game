// Класс Предмет
import { gameState } from '../gameState.js';

export class Item {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.baseX = x;
        this.baseY = y;
        this.density = (Math.random() * 30) + 1;
        this.threadAngle = Math.random() * Math.PI;
        this.eaten = false;
        this.respawnTimer = 0;
        let rand = Math.random();
        if (rand < 0.8) {
            this.type = 'yarn';
            this.size = 5;
            let colors = ['#ff6b6b', '#4ecdc4', '#ffe66d', '#ff9ff3', '#54a0ff', '#5f27cd'];
            this.color = colors[Math.floor(Math.random() * colors.length)];
        } else {
            this.type = 'food';
            this.size = 3;
            this.color = '#8B4513';
        }
        this.vx = 0;
        this.vy = 0;
        this.friction = 0.92;
        this.returnSpeed = 0.04;
    }
    
    draw() {
        if (this.eaten) return;
        const ctx = gameState.ctx;
        if (this.type === 'yarn') {
            ctx.fillStyle = 'rgba(0,0,0,0.3)';
            ctx.beginPath();
            ctx.arc(this.x + 2, this.y + 2, this.size, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = this.color;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fill();
            ctx.save();
            ctx.translate(this.x, this.y);
            ctx.rotate(this.threadAngle);
            ctx.strokeStyle = 'rgba(255,255,255,0.4)';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(-this.size + 1, 0);
            ctx.quadraticCurveTo(0, -this.size + 2, this.size - 1, 0);
            ctx.moveTo(0, -this.size + 1);
            ctx.quadraticCurveTo(this.size - 2, 0, 0, this.size - 1);
            ctx.stroke();
            ctx.restore();
        } else {
            ctx.fillStyle = this.color;
            ctx.beginPath();
            ctx.moveTo(this.x, this.y - this.size);
            ctx.lineTo(this.x + this.size, this.y + this.size);
            ctx.lineTo(this.x - this.size, this.y + this.size);
            ctx.fill();
        }
    }
    
    update() {
        if (this.eaten) {
            this.respawnTimer--;
            if (this.respawnTimer <= 0) {
                this.eaten = false;
                this.size = (this.type === 'food') ? 3 : 5;
            }
            return;
        }
        let dx = gameState.mouse.x - this.x, dy = gameState.mouse.y - this.y;
        let d = Math.sqrt(dx*dx + dy*dy);
        if (d < gameState.mouse.radius) {
            let force = (gameState.mouse.radius - d) / gameState.mouse.radius;
            let angle = Math.atan2(dy, dx);
            this.vx -= Math.cos(angle) * force * 0.5;
            this.vy -= Math.sin(angle) * force * 0.5;
        }
        gameState.catsArray.forEach(cat => {
            if (cat.type === 'BITER' && cat.isActing) {
                let bx = this.x - cat.x, by = this.y - cat.y, dist = Math.sqrt(bx*bx + by*by);
                if (dist < cat.actionRadius && dist > cat.actionRadius - 50) {
                    let a = Math.atan2(by, bx);
                    this.vx += Math.cos(a) * 30;
                    this.vy += Math.sin(a) * 30;
                }
            } else if (['RUNNER','CRAZY','PLAYER'].includes(cat.type)) {
                let dist = Math.sqrt((this.x-cat.x)**2 + (this.y-cat.y)**2);
                if (dist < 30) {
                    let a = Math.atan2(this.y-cat.y, this.x-cat.x);
                    let f = (cat.type === 'CRAZY') ? 5 : 2;
                    this.vx += Math.cos(a) * f;
                    this.vy += Math.sin(a) * f;
                }
            }
        });
        gameState.dogsArray.forEach(dog => {
            let dist = Math.sqrt((this.x-dog.x)**2 + (this.y-dog.y)**2);
            if (dist < 40) {
                let a = Math.atan2(this.y-dog.y, this.x-dog.x);
                this.vx += Math.cos(a) * 3;
                this.vy += Math.sin(a) * 3;
            }
        });
        this.x += this.vx;
        this.y += this.vy;
        this.vx *= this.friction;
        this.vy *= this.friction;
        // Ограничение частиц внутри игровой области
        this.x = Math.max(gameState.gameArea.left + 10, Math.min(gameState.gameArea.right - 10, this.x));
        this.y = Math.max(gameState.gameArea.top + 10, Math.min(gameState.gameArea.bottom - 10, this.y));
        if (this.x !== this.baseX) this.x -= (this.x - this.baseX) * this.returnSpeed;
        if (this.y !== this.baseY) this.y -= (this.y - this.baseY) * this.returnSpeed;
    }
}

