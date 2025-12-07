// Класс Аквариум
import { gameState } from '../gameState.js';

export class Aquarium {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = 140;
        this.height = 90;
        this.fishX = 20;
        this.fishY = 45;
        this.fishSpeed = 1;
        this.bubbles = [];
    }
    
    update() {
        this.fishX += this.fishSpeed;
        if (this.fishX > this.width - 20) this.fishSpeed = -1;
        if (this.fishX < 20) this.fishSpeed = 1;
        this.fishY = 45 + Math.sin(Date.now() * 0.005) * 10;
        if (Math.random() < 0.05) {
            this.bubbles.push({x: Math.random() * this.width, y: this.height, speed: 0.5 + Math.random()});
        }
        for (let i = this.bubbles.length - 1; i >= 0; i--) {
            let b = this.bubbles[i];
            b.y -= b.speed;
            if (b.y < 0) this.bubbles.splice(i, 1);
        }
    }
    
    draw() {
        const ctx = gameState.ctx;
        ctx.save();
        ctx.translate(this.x, this.y - this.height);
        ctx.fillStyle = 'rgba(0, 150, 255, 0.3)';
        ctx.strokeStyle = '#aaa';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.rect(0, 0, this.width, this.height);
        ctx.fill();
        ctx.stroke();
        ctx.strokeStyle = 'green';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(20, this.height);
        ctx.quadraticCurveTo(25, this.height-20, 15, this.height-40);
        ctx.moveTo(100, this.height);
        ctx.quadraticCurveTo(95, this.height-25, 105, this.height-50);
        ctx.stroke();
        ctx.fillStyle = 'orange';
        ctx.beginPath();
        ctx.ellipse(this.fishX, this.fishY, 8, 5, 0, 0, Math.PI*2);
        ctx.fill();
        ctx.beginPath();
        if (this.fishSpeed > 0) {
            ctx.moveTo(this.fishX - 8, this.fishY);
            ctx.lineTo(this.fishX - 12, this.fishY - 4);
            ctx.lineTo(this.fishX - 12, this.fishY + 4);
        } else {
            ctx.moveTo(this.fishX + 8, this.fishY);
            ctx.lineTo(this.fishX + 12, this.fishY - 4);
            ctx.lineTo(this.fishX + 12, this.fishY + 4);
        }
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        this.bubbles.forEach(b => {
            ctx.beginPath();
            ctx.arc(b.x, b.y, 2, 0, Math.PI*2);
            ctx.fill();
        });
        ctx.fillStyle = '#333';
        ctx.fillRect(-5, -5, this.width + 10, 10);
        ctx.restore();
    }
}


