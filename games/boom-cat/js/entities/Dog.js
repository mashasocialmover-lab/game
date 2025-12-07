// Класс Собака
import { gameState } from '../gameState.js';
import { getRandomName, adjustColor } from '../utils.js';
import { playSound } from '../audio.js';
import { drawHpBar } from '../ui.js';

export class Dog {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.id = Math.random();
        this.name = getRandomName('DOG');
        this.markedForDeletion = false;
        this.isPlayer = false;
        this.actionCooldown = 0;
        this.frame = 0;
        this.angle = Math.random() * Math.PI * 2;
        this.speed = 7;
        this.vx = Math.cos(this.angle) * this.speed;
        this.vy = Math.sin(this.angle) * this.speed;
        this.state = 'WANDERING';
        this.barkTimer = 100 + Math.random() * 200;
        this.colors = ['#A0522D', '#222', '#DEB887', '#F5DEB3', '#8B4513'];
        this.skinColor = '#A0522D';
        this.maxHp = 5;
        this.hp = 5;
        playSound('bark');
    }
    
    changeAppearance() {
        let idx = this.colors.indexOf(this.skinColor);
        let nextIdx = (idx + 1) % this.colors.length;
        this.skinColor = this.colors[nextIdx];
    }
    
    update() {
        if (gameState.isPaused && !this.isPlayer) return;
        this.frame++;
        if ((this.vx !== 0 || this.vy !== 0) && this.frame % 15 === 0) {
            gameState.footprints.push({x: this.x, y: this.y, angle: this.angle, life: 150, type: 'paw'});
        }
        if (this.actionCooldown > 0) this.actionCooldown--;
        if (this.isPlayer) {
            this.handlePlayerInput();
            return;
        }
        if (this.state === 'WANDERING') {
            this.barkTimer--;
            if (this.barkTimer <= 0) {
                this.doBark();
                this.barkTimer = 150 + Math.random() * 300;
            }
            this.x += this.vx;
            this.y += this.vy;
            if (this.x < gameState.gameArea.left + 50 || this.x > gameState.gameArea.right - 50) this.vx *= -1;
            if (this.y < gameState.gameArea.top + 50 || this.y > gameState.gameArea.bottom - 50) this.vy *= -1;
            this.angle = Math.atan2(this.vy, this.vx);
        } else if (this.state === 'FLEEING') {
            this.x += this.vx;
            this.y += this.vy;
            if (this.x < gameState.gameArea.left - 100 || this.x > gameState.gameArea.right + 100 || 
                this.y < gameState.gameArea.top - 100 || this.y > gameState.gameArea.bottom + 100) {
                this.markedForDeletion = true;
            }
        }
    }
    
    handlePlayerInput() {
        this.vx = 0;
        this.vy = 0;
        let moveSpeed = 5;
        if (gameState.keys.KeyW) this.vy = -moveSpeed;
        if (gameState.keys.KeyS) this.vy = moveSpeed;
        if (gameState.keys.KeyA) this.vx = -moveSpeed;
        if (gameState.keys.KeyD) this.vx = moveSpeed;
        if (this.vx !== 0 && this.vy !== 0) {
            this.vx *= 0.71;
            this.vy *= 0.71;
        }
        this.x += this.vx;
        this.y += this.vy;
        if (this.vx !== 0 || this.vy !== 0) this.angle = Math.atan2(this.vy, this.vx);
        if (gameState.keys.KeyE && this.actionCooldown <= 0) {
            this.doBark();
            this.actionCooldown = 60;
        }
        // Ограничение движения внутри игровой области
        this.x = Math.max(gameState.gameArea.left + 20, Math.min(gameState.gameArea.right - 20, this.x));
        this.y = Math.max(gameState.gameArea.top + 20, Math.min(gameState.gameArea.bottom - 20, this.y));
    }
    
    doBark() {
        playSound('bark');
        gameState.catsArray.forEach(cat => {
            if (cat.state === 'WATCHING_FISH') return;
            let d = Math.sqrt((this.x - cat.x)**2 + (this.y - cat.y)**2);
            if (d < 60 && cat.actionCooldown <= 0 && cat.type !== 'BITER') {
                cat.hp--;
                cat.injuredTimer = 500;
                cat.actionCooldown = 60;
                playSound('whine');
                if (cat.hp <= 0) {
                    cat.markedForDeletion = true;
                    playSound('whine');
                }
            }
            if (d < 200 && cat.type !== 'CRAZY' && cat.type !== 'BITER') {
                cat.state = 'PANIC_RUN';
                cat.angle = Math.atan2(cat.y - this.y, cat.x - this.x);
                cat.vx = Math.cos(cat.angle) * 15;
                cat.vy = Math.sin(cat.angle) * 15;
            }
        });
    }
    
    draw() {
        const ctx = gameState.ctx;
        ctx.save();
        ctx.translate(this.x, this.y);
        drawHpBar(ctx, this.hp, this.maxHp);
        if (!this.isPlayer) {
            ctx.fillStyle = '#fff';
            ctx.font = '12px Arial';
            ctx.textAlign = 'center';
            ctx.strokeStyle = 'black';
            ctx.lineWidth = 3;
            ctx.strokeText(this.name, 0, -35);
            ctx.fillText(this.name, 0, -35);
        }
        if (this.isPlayer) {
            ctx.beginPath();
            ctx.ellipse(0, 5, 30, 15, 0, 0, Math.PI*2);
            ctx.strokeStyle = 'lime';
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.fillStyle = 'white';
            ctx.font = "bold 12px Arial";
            ctx.textAlign = "center";
            ctx.fillText("YOU", 0, -40);
        } else {
            ctx.fillStyle = 'rgba(0,0,0,0.3)';
            ctx.beginPath();
            ctx.ellipse(0, 5, 20, 10, 0, 0, Math.PI*2);
            ctx.fill();
        }
        ctx.rotate(this.angle + Math.PI/2);
        let walkCycle = this.frame * 0.2;
        if ((this.isPlayer && this.vx === 0 && this.vy === 0) || (gameState.isPaused && !this.isPlayer)) walkCycle = 0;
        let bodyStretch = Math.sin(walkCycle * 2) * 2;
        ctx.strokeStyle = '#8B4513';
        ctx.lineWidth = 10;
        ctx.lineCap = 'round';
        let l1 = Math.sin(walkCycle)*12, l2 = Math.sin(walkCycle+Math.PI)*12;
        ctx.beginPath();
        ctx.moveTo(-12, 0);
        ctx.lineTo(-12, -15 + l1);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(12, 0);
        ctx.lineTo(12, -15 + l2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-12, 20);
        ctx.lineTo(-12, 35 + l2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(12, 20);
        ctx.lineTo(12, 35 + l1);
        ctx.stroke();
        let tailWag = Math.sin(this.frame * 0.5) * 15;
        ctx.beginPath();
        ctx.lineWidth = 8;
        ctx.moveTo(0, 35);
        ctx.lineTo(tailWag, 55);
        ctx.stroke();
        ctx.fillStyle = this.skinColor;
        ctx.beginPath();
        ctx.ellipse(0, 10, 18 - bodyStretch, 30 + bodyStretch, 0, 0, Math.PI*2);
        ctx.fill();
        ctx.strokeStyle = 'blue';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(-14, -10);
        ctx.quadraticCurveTo(0, -8, 14, -10);
        ctx.stroke();
        ctx.fillStyle = this.skinColor;
        ctx.beginPath();
        ctx.arc(0, -15, 20, 0, Math.PI*2);
        ctx.fill();
        ctx.fillStyle = adjustColor(this.skinColor, -40);
        ctx.beginPath();
        ctx.ellipse(-18, -10, 8, 15, 0.5, 0, Math.PI*2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(18, -10, 8, 15, -0.5, 0, Math.PI*2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(-8, -20, 6, 0, Math.PI*2);
        ctx.fill();
        ctx.fillStyle = 'black';
        ctx.beginPath();
        ctx.arc(-8, -20, 2, 0, Math.PI*2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(8, -20, 2, 0, Math.PI*2);
        ctx.fill();
        ctx.fillStyle = 'black';
        ctx.beginPath();
        ctx.ellipse(0, -8, 5, 3, 0, 0, Math.PI*2);
        ctx.fill();
        if (this.state === 'FLEEING') {
            ctx.rotate(-(this.angle + Math.PI/2));
            ctx.fillStyle = 'white';
            ctx.font = "bold 20px Arial";
            ctx.fillText("?!", 0, -50);
        }
        ctx.restore();
    }
}


