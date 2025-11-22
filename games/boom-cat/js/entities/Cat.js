// Класс Кот
import { gameState } from '../gameState.js';
import { getRandomName } from '../utils.js';
import { playSound } from '../audio.js';
import { drawHpBar, showAchievement } from '../ui.js';

export class Cat {
    constructor(x, y, forcedType = null) {
        this.x = x;
        this.y = y;
        this.id = Math.random();
        this.name = (forcedType === 'BITER') ? 'БАБАХ' : getRandomName('CAT');
        this.markedForDeletion = false;
        this.isPlayer = false;
        this.actionCooldown = 0;
        this.swipeAnimTimer = 0;
        this.injuredTimer = 0;
        this.accessory = 'NONE';
        this.accessoryList = ['NONE', 'GLASSES', 'TOPHAT', 'CROWN', 'BOW'];
        this.fishWatchTimer = 0;
        this.frame = 0;
        this.blinkTimer = Math.random() * 200;
        this.isBlinking = false;
        this.availableSkins = ['orange', 'white', 'grey', 'siamese', 'calico', 'tuxedo', 'tabby', 'black'];

        if (forcedType) {
            this.type = forcedType;
        } else {
            let rand = Math.random();
            if (rand < 0.05) this.type = 'CRAZY';
            else if (rand < 0.15) this.type = 'EATER';
            else if (rand < 0.25) this.type = 'PLAYER';
            else if (rand < 0.35) this.type = 'BITER';
            else this.type = 'RUNNER';
        }

        if (this.type === 'CRAZY' || this.type === 'BITER') {
            this.skin = 'black';
        } else {
            let safeSkins = this.availableSkins.filter(s => s !== 'black');
            this.skin = safeSkins[Math.floor(Math.random() * safeSkins.length)];
        }

        if (this.type === 'CRAZY') { this.maxHp = 4; this.hp = 4; }
        else if (this.type === 'PLAYER' || this.type === 'EATER') { this.maxHp = 2; this.hp = 2; }
        else if (this.type === 'BITER') { this.maxHp = 0; this.hp = 0; }
        else { this.maxHp = 3; this.hp = 3; }

        this.setStatsByType();
        this.colors = this.getSkinColors();
    }

    changeAccessory() {
        let idx = this.accessoryList.indexOf(this.accessory);
        let nextIdx = (idx + 1) % this.accessoryList.length;
        this.accessory = this.accessoryList[nextIdx];
    }

    setStatsByType() {
        if (this.type === 'CRAZY') {
            this.speed = 18;
            this.bounceCount = 0;
            this.maxBounces = 5;
            this.chasingDog = null;
            playSound('meow');
        }
        else if (this.type === 'EATER') {
            this.foodConsumed = 0;
            this.maxFood = 6;
            this.targetItem = null;
            this.speed = 5;
            this.state = 'HUNTING';
        }
        else if (this.type === 'PLAYER') {
            this.targetItem = null;
            this.playTimer = 180;
            this.speed = 9;
            this.state = 'SEARCHING';
        }
        else if (this.type === 'BITER') {
            this.timer = 100;
            this.isActing = false;
            this.actionRadius = 0;
            this.maxActionRadius = 350;
            this.soundPlayed = false;
            this.speed = 6;
        }
        else {
            this.speed = 12 + Math.random() * 5;
            if (Math.random() > 0.6) playSound('meow');
        }
        if (this.type === 'BITER') this.angle = -Math.PI/2;
        else this.angle = Math.random() * Math.PI * 2;
        this.vx = Math.cos(this.angle) * this.speed;
        this.vy = Math.sin(this.angle) * this.speed;
    }

    changeAppearance() {
        let idx = this.availableSkins.indexOf(this.skin);
        let nextIdx = (idx + 1) % this.availableSkins.length;
        this.skin = this.availableSkins[nextIdx];
        this.colors = this.getSkinColors();
    }

    getSkinColors() {
        switch(this.skin) {
            case 'orange': return { b1: '#ffb347', b2: '#ffcc33', d: '#cc8400', e: '#90ee90' };
            case 'white': return { b1: '#f0f0f0', b2: '#ffffff', d: '#ddd', e: '#87ceeb' };
            case 'black': return { b1: '#2b2b2b', b2: '#404040', d: '#111', e: '#ffff00' };
            case 'grey': return { b1: '#a9a9a9', b2: '#c0c0c0', d: '#808080', e: '#98fb98' };
            case 'siamese': return { b1: '#fff5e1', b2: '#fffaf0', d: '#5c4a3d', e: '#00bfff' };
            case 'calico': return { b1: '#ffffff', b2: '#fff', d: 'calico', e: '#ffa500' };
            case 'tuxedo': return { b1: '#222', b2: '#333', d: 'tuxedo', e: '#adff2f' };
            case 'tabby': return { b1: '#b8a488', b2: '#d2b48c', d: 'tabby', e: '#32cd32' };
            default: return { b1: '#fff', b2: '#fff', d: '#ccc', e: 'blue' };
        }
    }

    findNearestItem(type) {
        let closest = null, minDist = Infinity;
        for (let p of gameState.particleArray) {
            if (p.type === type && !p.eaten) {
                let d = (p.x - this.x)**2 + (p.y - this.y)**2;
                if (d < minDist) { minDist = d; closest = p; }
            }
        }
        return closest;
    }

    update() {
        if (gameState.isPaused && !this.isPlayer) return;
        this.frame++;
        if (this.swipeAnimTimer > 0) this.swipeAnimTimer--;
        if (this.injuredTimer > 0) this.injuredTimer--;
        if ((this.vx !== 0 || this.vy !== 0) && this.frame % 15 === 0) {
            gameState.footprints.push({x: this.x, y: this.y, angle: this.angle, life: 150, type: 'paw'});
        }
        this.blinkTimer--;
        if (this.blinkTimer <= 0) {
            this.isBlinking = true;
            if (this.blinkTimer <= -10) {
                this.isBlinking = false;
                this.blinkTimer = 100 + Math.random() * 300;
            }
        }
        if (this.actionCooldown > 0) this.actionCooldown--;
        if (this.isPlayer) {
            this.handlePlayerInput();
            if (this.type === 'BITER' && this.isActing) {
                this.actionRadius += 20;
                if (this.actionRadius >= this.maxActionRadius) {
                    this.markedForDeletion = true;
                    gameState.playerEntity = null;
                }
            }
            return;
        }
        if (this.state === 'WATCHING_FISH') {
            this.fishWatchTimer--;
            this.vx = 0;
            this.vy = 0;
            this.angle = Math.atan2(gameState.aquarium.y - (gameState.aquarium.height/2) - this.y, gameState.aquarium.x + (gameState.aquarium.width/2) - this.x);
            if (this.fishWatchTimer <= 0) {
                this.state = 'WANDERING';
                this.angle += Math.PI;
            }
            return;
        }
        if (gameState.aquarium && ['RUNNER', 'EATER', 'PLAYER'].includes(this.type) && this.state !== 'PANIC_RUN') {
            let distToTank = Math.sqrt((this.x - (gameState.aquarium.x + 70))**2 + (this.y - (gameState.aquarium.y - 20))**2);
            if (distToTank < 100 && Math.random() < 0.02) {
                this.state = 'WATCHING_FISH';
                this.fishWatchTimer = 300 + Math.random() * 300;
            }
        }
        let nearestDog = null;
        let minDogDist = 200;
        for (let dog of gameState.dogsArray) {
            let d = Math.sqrt((this.x - dog.x)**2 + (this.y - dog.y)**2);
            if (d < minDogDist) { minDogDist = d; nearestDog = dog; }
        }
        if (nearestDog) {
            if (this.type === 'CRAZY') {
                this.chasingDog = nearestDog;
                let angleToDog = Math.atan2(nearestDog.y - this.y, nearestDog.x - this.x);
                this.vx = Math.cos(angleToDog) * 20;
                this.vy = Math.sin(angleToDog) * 20;
                this.x += this.vx;
                this.y += this.vy;
                this.x = Math.max(gameState.gameArea.left + 20, Math.min(gameState.gameArea.right - 20, this.x));
                this.y = Math.max(gameState.gameArea.top + 20, Math.min(gameState.gameArea.bottom - 20, this.y));
                if (minDogDist < 40) {
                    playSound('hiss');
                    playSound('whine');
                    nearestDog.state = 'FLEEING';
                    nearestDog.angle = angleToDog;
                    nearestDog.vx = Math.cos(angleToDog) * 15;
                    nearestDog.vy = Math.sin(angleToDog) * 15;
                }
            } else if (this.type !== 'BITER') {
                if (this.state !== 'PANIC_RUN') {
                    this.state = 'PANIC_RUN';
                    let angleFromDog = Math.atan2(this.y - nearestDog.y, this.x - nearestDog.x);
                    let randomScattering = (Math.random() - 0.5) * 2.5;
                    this.angle = angleFromDog + randomScattering;
                    let panicSpeed = (this.speed < 15) ? 15 : this.speed + 2;
                    this.vx = Math.cos(this.angle) * panicSpeed;
                    this.vy = Math.sin(this.angle) * panicSpeed;
                }
                this.x += this.vx;
                this.y += this.vy;
                this.x = Math.max(gameState.gameArea.left + 20, Math.min(gameState.gameArea.right - 20, this.x));
                this.y = Math.max(gameState.gameArea.top + 20, Math.min(gameState.gameArea.bottom - 20, this.y));
                if (this.isOffScreen()) this.markedForDeletion = true;
                return;
            }
        } else {
            if (this.state === 'PANIC_RUN') this.state = 'WANDERING';
        }

        if (this.type === 'EATER') {
            if (this.state === 'HUNTING') {
                if (!this.targetItem || this.targetItem.eaten) this.targetItem = this.findNearestItem('food');
                if (this.targetItem) {
                    let dx = this.targetItem.x - this.x, dy = this.targetItem.y - this.y;
                    let d = Math.sqrt(dx*dx + dy*dy);
                    this.angle = Math.atan2(dy, dx);
                    if (d > 10) {
                        this.x += Math.cos(this.angle) * this.speed;
                        this.y += Math.sin(this.angle) * this.speed;
                        this.x = Math.max(gameState.gameArea.left + 20, Math.min(gameState.gameArea.right - 20, this.x));
                        this.y = Math.max(gameState.gameArea.top + 20, Math.min(gameState.gameArea.bottom - 20, this.y));
                    } else {
                        playSound('eat');
                        this.targetItem.eaten = true;
                        this.targetItem.size = 0;
                        this.targetItem.respawnTimer = 300;
                        this.foodConsumed++;
                        if (this.isPlayer) {
                            gameState.gameStats.foodEaten++;
                            if (gameState.gameStats.foodEaten % 10 === 0) showAchievement("🍖 ВЕЛИКИЙ ОБЖОРА!", "🍖");
                        }
                        this.targetItem = null;
                        if (this.foodConsumed >= this.maxFood) {
                            this.state = 'LEAVING';
                            this.angle = Math.random() * Math.PI * 2;
                        }
                    }
                } else {
                    this.state = 'LEAVING';
                    this.angle = Math.random() * Math.PI * 2;
                }
            } else if (this.state === 'LEAVING') {
                this.x += Math.cos(this.angle) * this.speed * 1.5;
                this.y += Math.sin(this.angle) * this.speed * 1.5;
                this.x = Math.max(gameState.gameArea.left + 20, Math.min(gameState.gameArea.right - 20, this.x));
                this.y = Math.max(gameState.gameArea.top + 20, Math.min(gameState.gameArea.bottom - 20, this.y));
                if (this.isOffScreen()) this.markedForDeletion = true;
            }
        }
        else if (this.type === 'PLAYER') {
            if (this.state === 'SEARCHING') {
                if (!this.targetItem) this.targetItem = this.findNearestItem('yarn');
                if (this.targetItem) {
                    let dx = this.targetItem.x - this.x, dy = this.targetItem.y - this.y;
                    let d = Math.sqrt(dx*dx + dy*dy);
                    this.angle = Math.atan2(dy, dx);
                    if (d > 40) {
                        this.x += Math.cos(this.angle) * this.speed;
                        this.y += Math.sin(this.angle) * this.speed;
                        this.x = Math.max(gameState.gameArea.left + 20, Math.min(gameState.gameArea.right - 20, this.x));
                        this.y = Math.max(gameState.gameArea.top + 20, Math.min(gameState.gameArea.bottom - 20, this.y));
                    } else {
                        this.state = 'PLAYING';
                    }
                } else {
                    this.state = 'LEAVING';
                    this.angle = Math.random() * Math.PI * 2;
                }
            } else if (this.state === 'PLAYING') {
                this.playTimer--;
                if (this.targetItem) {
                    this.angle = Math.atan2(this.targetItem.y - this.y, this.targetItem.x - this.x);
                    if (this.frame % 20 === 0) {
                        let push = this.angle + (Math.random() - 0.5);
                        this.targetItem.vx += Math.cos(push) * 4;
                        this.targetItem.vy += Math.sin(push) * 4;
                    }
                }
                if (this.playTimer <= 0) {
                    this.state = 'LEAVING';
                    this.angle = Math.random() * Math.PI * 2;
                }
            } else if (this.state === 'LEAVING') {
                this.x += Math.cos(this.angle) * this.speed;
                this.y += Math.sin(this.angle) * this.speed;
                this.x = Math.max(gameState.gameArea.left + 20, Math.min(gameState.gameArea.right - 20, this.x));
                this.y = Math.max(gameState.gameArea.top + 20, Math.min(gameState.gameArea.bottom - 20, this.y));
                if (this.isOffScreen()) this.markedForDeletion = true;
            }
        }
        else if (this.type === 'BITER') {
            if (this.isActing) {
                this.actionRadius += 20;
                if (this.actionRadius >= this.maxActionRadius) {
                    this.markedForDeletion = true;
                }
                [...gameState.dogsArray, ...gameState.miceArray].forEach(target => {
                    let d = Math.sqrt((this.x - target.x)**2 + (this.y - target.y)**2);
                    if (d < this.actionRadius) {
                        target.hp = 0;
                        target.markedForDeletion = true;
                    }
                });
            } else {
                if (this.timer > 0) this.timer--;
                else {
                    this.isActing = true;
                    playSound('boom');
                }
            }
        }
        else {
            this.x += this.vx;
            this.y += this.vy;
            this.x = Math.max(gameState.gameArea.left + 20, Math.min(gameState.gameArea.right - 20, this.x));
            this.y = Math.max(gameState.gameArea.top + 20, Math.min(gameState.gameArea.bottom - 20, this.y));
            
            if (this.type === 'CRAZY' && this.bounceCount < this.maxBounces && !this.chasingDog) {
                let hit = false;
                if (this.x <= gameState.gameArea.left + 30 || this.x >= gameState.gameArea.right - 30) {
                    this.vx *= -1;
                    hit = true;
                    this.angle = Math.atan2(this.vy, this.vx);
                }
                if (this.y <= gameState.gameArea.top + 30 || this.y >= gameState.gameArea.bottom - 30) {
                    this.vy *= -1;
                    hit = true;
                    this.angle = Math.atan2(this.vy, this.vx);
                }
                if (hit) {
                    this.bounceCount++;
                    playSound('bounce');
                }
            } else if (!this.chasingDog) {
                this.angle = Math.atan2(this.vy, this.vx);
            }
            if (this.isOffScreen()) {
                if (this.type !== 'CRAZY' || this.bounceCount >= this.maxBounces) this.markedForDeletion = true;
            }
        }
    }

    handlePlayerInput() {
        if (this.type === 'BITER' && this.isActing) return;
        this.vx = 0;
        this.vy = 0;
        let moveSpeed = 5;
        if (this.type === 'CRAZY') moveSpeed = 8;
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
        this.x = Math.max(gameState.gameArea.left + 20, Math.min(gameState.gameArea.right - 20, this.x));
        this.y = Math.max(gameState.gameArea.top + 20, Math.min(gameState.gameArea.bottom - 20, this.y));
        if (gameState.keys.KeyE && this.actionCooldown <= 0) {
            this.doPlayerAction();
        }
        if (gameState.keys.KeyQ && this.actionCooldown <= 0) {
            this.doSwipeAttack();
            gameState.gameStats.swipes++;
            if (gameState.gameStats.swipes === 5 || gameState.gameStats.swipes === 20) showAchievement("🥊 БОЕЦ!", "🥊");
            this.actionCooldown = 20;
        }
    }
    
    doSwipeAttack() {
        playSound('swipe');
        this.swipeAnimTimer = 10;
        gameState.miceArray.forEach(mouse => {
            let d = Math.sqrt((this.x - mouse.x)**2 + (this.y - mouse.y)**2);
            if (d < 80) {
                mouse.hp--;
                playSound('squeak');
                if (mouse.hp <= 0) {
                    mouse.markedForDeletion = true;
                    gameState.gameStats.miceCaught++;
                    if (gameState.gameStats.miceCaught === 5) showAchievement("🐭 ГРОЗА МЫШЕЙ!", "😼");
                }
            }
        });
        gameState.dogsArray.forEach(dog => {
            let d = Math.sqrt((this.x - dog.x)**2 + (this.y - dog.y)**2);
            if (d < 80) {
                dog.hp--;
                playSound('whine');
                if (dog.hp <= 0) {
                    dog.markedForDeletion = true;
                    gameState.gameStats.enemiesDefeated++;
                    showAchievement("ВРАГ ПОВЕРЖЕН!", "💀");
                }
            }
        });
    }

    doPlayerAction() {
        this.actionCooldown = 30;
        if (this.type === 'BITER') {
            this.timer = 0;
            this.isActing = true;
            this.actionCooldown = 9999;
            playSound('boom');
        }
        else if (this.type === 'EATER') {
            let item = this.findNearestItem('food');
            if (item && Math.sqrt((this.x-item.x)**2 + (this.y-item.y)**2) < 30) {
                playSound('eat');
                item.eaten = true;
                item.size = 0;
                item.respawnTimer = 300;
                this.foodConsumed++;
                if (this.isPlayer) {
                    gameState.gameStats.foodEaten++;
                    if (gameState.gameStats.foodEaten % 10 === 0) showAchievement("🍖 ВЕЛИКИЙ ОБЖОРА!", "🍖");
                }
            }
        }
        else if (this.type === 'PLAYER') {
            let item = this.findNearestItem('yarn');
            if (item && Math.sqrt((this.x-item.x)**2 + (this.y-item.y)**2) < 50) {
                let push = this.angle;
                item.vx += Math.cos(push) * 15;
                item.vy += Math.sin(push) * 15;
                this.state = 'PLAYING';
                setTimeout(() => this.state = 'SEARCHING', 300);
            }
        }
        else if (this.type === 'CRAZY') {
            playSound('hiss');
            gameState.dogsArray.forEach(dog => {
                let d = Math.sqrt((this.x - dog.x)**2 + (this.y - dog.y)**2);
                if (d < 200) {
                    playSound('whine');
                    dog.state = 'FLEEING';
                    dog.angle = Math.atan2(dog.y - this.y, dog.x - this.x);
                    dog.vx = Math.cos(dog.angle) * 15;
                    dog.vy = Math.sin(dog.angle) * 15;
                }
            });
        } else {
            playSound('meow');
        }
    }

    isOffScreen() {
        return (this.x < gameState.gameArea.left - 100 || this.x > gameState.gameArea.right + 100 ||
                this.y < gameState.gameArea.top - 100 || this.y > gameState.gameArea.bottom + 100);
    }

    draw() {
        const ctx = gameState.ctx;
        if (this.type === 'BITER' && this.isActing) {
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.actionRadius, 0, Math.PI*2);
            let a = 1 - (this.actionRadius/this.maxActionRadius);
            let grd = ctx.createRadialGradient(this.x, this.y, this.actionRadius*0.5, this.x, this.y, this.actionRadius);
            grd.addColorStop(0, `rgba(255, 255, 200, ${a})`);
            grd.addColorStop(1, `rgba(255, 50, 0, 0)`);
            ctx.fillStyle = grd;
            ctx.fill();
            ctx.font = "900 40px Impact";
            ctx.fillStyle = `rgba(255, 255, 255, ${a})`;
            ctx.strokeStyle = `rgba(0,0,0,${a})`;
            ctx.lineWidth = 4;
            ctx.textAlign = "center";
            ctx.strokeText("БАБАХ!", this.x, this.y);
            ctx.fillText("БАБАХ!", this.x, this.y);
            return;
        }

        ctx.save();
        ctx.translate(this.x, this.y);
        
        if (this.type !== 'BITER') drawHpBar(ctx, this.hp, this.maxHp);

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
            ctx.ellipse(0, 5, 25, 15, 0, 0, Math.PI*2);
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
            ctx.ellipse(0, 5, 15, 8, 0, 0, Math.PI*2);
            ctx.fill();
        }

        if (this.state === 'WATCHING_FISH') {
            ctx.fillStyle = '#4db8ff';
            ctx.font = '20px Arial';
            ctx.fillText("💙", 0, -45 - (this.frame % 20));
        }

        let buttWiggle = (this.type === 'PLAYER' && this.state === 'PLAYING') ? Math.sin(this.frame * 0.8) * 0.15 : 0;
        ctx.rotate(this.angle + Math.PI/2 + buttWiggle);
        let crouch = 1;
        if (this.type === 'PLAYER' && this.state === 'PLAYING') crouch = 0.7;
        else if (this.state === 'WATCHING_FISH') crouch = 0.8;
        else if (this.type === 'BITER' && !this.isActing && this.timer < 30) crouch = 0.8 + Math.sin(this.frame) * 0.05;
        ctx.scale(1, crouch);

        if (this.swipeAnimTimer > 0) {
            ctx.save();
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(0, -35, 25, -Math.PI/2 - 0.5, -Math.PI/2 + 0.5);
            ctx.stroke();
            ctx.restore();
        }

        let speedFactor = (this.speed || 0) / 20;
        let walkCycle = this.frame * 0.3 * (this.speed ? this.speed/5 : 0.5);
        if ((this.isPlayer && this.vx === 0 && this.vy === 0) || (gameState.isPaused && !this.isPlayer) || this.state === 'WATCHING_FISH') walkCycle = 0;

        let stretch = Math.sin(walkCycle * 2) * 5 * speedFactor;
        let bodyLength = 25 + (this.speed ? this.speed : 0);

        ctx.strokeStyle = this.colors.b1;
        ctx.lineWidth = 6;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(0, bodyLength/2);
        let tailSway = (this.speed > 2) ? Math.sin(walkCycle) * 5 : Math.sin(this.frame * 0.05) * 15;
        if (this.type === 'PLAYER' && this.state === 'PLAYING') tailSway = Math.sin(this.frame * 0.5) * 15;
        if (this.type === 'CRAZY' && this.chasingDog) {
            tailSway = (Math.random() - 0.5) * 20;
            ctx.lineWidth = 10;
        }
        ctx.quadraticCurveTo(tailSway, bodyLength + 10, tailSway * 0.5, bodyLength + 25);
        ctx.stroke();

        let pawColor = this.colors.b2;
        let legFL = 0, legFR = 0, legBL = 0, legBR = 0;
        if (this.type === 'PLAYER' && this.state === 'PLAYING') {
            let swipe = Math.sin(this.frame * 0.3);
            if (swipe > 0) legFL = swipe * 15;
            else legFR = -swipe * 15;
        }
        else if (this.type !== 'BITER') {
            legFL = Math.sin(walkCycle) * 10;
            legFR = Math.sin(walkCycle + Math.PI) * 10;
            legBL = Math.sin(walkCycle + Math.PI) * 12;
            legBR = Math.sin(walkCycle) * 12;
        }
        if (this.swipeAnimTimer > 0) { legFR = -20; }

        ctx.strokeStyle = pawColor;
        ctx.lineWidth = 8;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-8, 15);
        ctx.lineTo(-10, 20 + legBL);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(8, 15);
        ctx.lineTo(10, 20 + legBR);
        ctx.stroke();

        let bodyGrad = ctx.createRadialGradient(-5, -5, 2, 0, 0, 20);
        bodyGrad.addColorStop(0, this.colors.b2);
        bodyGrad.addColorStop(1, this.colors.b1);
        ctx.fillStyle = bodyGrad;
        ctx.beginPath();
        ctx.ellipse(0, 5, 14 - Math.abs(stretch)/3, bodyLength/2 + stretch, 0, 0, Math.PI*2);
        ctx.fill();

        if (this.colors.d === 'tuxedo') {
            ctx.fillStyle = '#222';
            ctx.beginPath();
            ctx.ellipse(0, 10, 10, 15, 0, 0, Math.PI*2);
            ctx.fill();
        }
        else if (this.colors.d === 'calico') {
            ctx.fillStyle = '#222';
            ctx.beginPath();
            ctx.arc(5, 10, 6, 0, Math.PI*2);
            ctx.fill();
            ctx.fillStyle = '#d2691e';
            ctx.beginPath();
            ctx.arc(-5, 5, 7, 0, Math.PI*2);
            ctx.fill();
        }

        ctx.strokeStyle = pawColor;
        ctx.beginPath();
        ctx.moveTo(-8, -5);
        ctx.lineTo(-10, -15 - legFL);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(8, -5);
        ctx.lineTo(10, -15 - legFR);
        ctx.stroke();

        let headShake = (this.type === 'EATER' && this.state === 'HUNTING' && this.targetItem && Math.sqrt((this.targetItem.x-this.x)**2+(this.targetItem.y-this.y)**2) < 15) ? Math.sin(this.frame) * 3 : 0;
        let headY = -bodyLength/2 + headShake;
        let earOffset = (this.type === 'PLAYER' && this.state === 'PLAYING') ? 5 : 0;
        
        ctx.fillStyle = (this.skin === 'siamese') ? this.colors.d : this.colors.b1;
        ctx.beginPath();
        ctx.moveTo(-12, headY-8+earOffset);
        ctx.quadraticCurveTo(-20, headY-20+earOffset, -4, headY-14+earOffset);
        ctx.moveTo(12, headY-8+earOffset);
        ctx.quadraticCurveTo(20, headY-20+earOffset, 4, headY-14+earOffset);
        ctx.fill();

        let headGrad = ctx.createRadialGradient(0, headY-5, 2, 0, headY, 16);
        headGrad.addColorStop(0, this.colors.b2);
        headGrad.addColorStop(1, this.colors.b1);
        ctx.fillStyle = headGrad;
        ctx.beginPath();
        ctx.arc(0, headY, 16, 0, Math.PI*2);
        ctx.fill();

        if (this.colors.d === 'siamese') {
            ctx.fillStyle = this.colors.d;
            ctx.beginPath();
            ctx.ellipse(0, headY+2, 10, 8, 0, 0, Math.PI*2);
            ctx.fill();
        }
        else if (this.colors.d === 'tabby') {
            ctx.strokeStyle = '#665';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(-5, headY-14);
            ctx.lineTo(-5, headY-8);
            ctx.moveTo(0, headY-14);
            ctx.lineTo(0, headY-8);
            ctx.moveTo(5, headY-14);
            ctx.lineTo(5, headY-8);
            ctx.stroke();
        }

        if (!this.isBlinking) {
            ctx.fillStyle = (this.type === 'CRAZY' && (this.chasingDog || (this.isPlayer && gameState.keys.KeyE))) ? '#ff0000' : this.colors.e;
            ctx.beginPath();
            ctx.arc(-6, headY-4, 3, 0, Math.PI*2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(6, headY-4, 3, 0, Math.PI*2);
            ctx.fill();
            ctx.fillStyle = '#000';
            ctx.beginPath();
            ctx.ellipse(-6, headY-4, 1, 2.5, 0, 0, Math.PI*2);
            ctx.fill();
            ctx.beginPath();
            ctx.ellipse(6, headY-4, 1, 2.5, 0, 0, Math.PI*2);
            ctx.fill();
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.arc(-7, headY-5, 1, 0, Math.PI*2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(5, headY-5, 1, 0, Math.PI*2);
            ctx.fill();
        } else {
            ctx.strokeStyle = '#333';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(-9, headY-4);
            ctx.lineTo(-3, headY-4);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(9, headY-4);
            ctx.lineTo(3, headY-4);
            ctx.stroke();
        }

        if (this.accessory === 'GLASSES') {
            ctx.fillStyle = 'black';
            ctx.fillRect(-10, headY - 8, 8, 5);
            ctx.fillRect(2, headY - 8, 8, 5);
            ctx.lineWidth = 1;
            ctx.strokeStyle = '#333';
            ctx.beginPath();
            ctx.moveTo(-2, headY-6);
            ctx.lineTo(2, headY-6);
            ctx.stroke();
        } else if (this.accessory === 'TOPHAT') {
            ctx.fillStyle = '#111';
            ctx.fillRect(-10, headY - 28, 20, 18);
            ctx.fillRect(-16, headY - 10, 32, 4);
            ctx.fillStyle = 'red';
            ctx.fillRect(-10, headY - 14, 20, 4);
        } else if (this.accessory === 'CROWN') {
            ctx.fillStyle = 'gold';
            ctx.beginPath();
            ctx.moveTo(-10, headY-10);
            ctx.lineTo(-10, headY-25);
            ctx.lineTo(-5, headY-15);
            ctx.lineTo(0, headY-28);
            ctx.lineTo(5, headY-15);
            ctx.lineTo(10, headY-25);
            ctx.lineTo(10, headY-10);
            ctx.fill();
        } else if (this.accessory === 'BOW') {
            ctx.fillStyle = 'red';
            ctx.beginPath();
            ctx.moveTo(0, headY+8);
            ctx.lineTo(-8, headY+4);
            ctx.lineTo(-8, headY+12);
            ctx.fill();
            ctx.beginPath();
            ctx.moveTo(0, headY+8);
            ctx.lineTo(8, headY+4);
            ctx.lineTo(8, headY+12);
            ctx.fill();
        }

        if (this.injuredTimer > 0) {
            ctx.save();
            ctx.rotate(0.5);
            ctx.fillStyle = '#f5cba7';
            ctx.fillRect(-8, -5, 16, 6);
            ctx.fillStyle = '#e6b0aa';
            ctx.beginPath();
            ctx.arc(-4, -2, 1, 0, Math.PI*2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(4, -2, 1, 0, Math.PI*2);
            ctx.fill();
            ctx.restore();
        }

        ctx.fillStyle = 'pink';
        ctx.beginPath();
        ctx.arc(0, headY+2, 2.5, 0, Math.PI*2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.6)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(2, headY+3);
        ctx.lineTo(18, headY+2);
        ctx.moveTo(2, headY+4);
        ctx.lineTo(16, headY+6);
        ctx.moveTo(-2, headY+3);
        ctx.lineTo(-18, headY+2);
        ctx.moveTo(-2, headY+4);
        ctx.lineTo(-16, headY+6);
        ctx.stroke();

        if (this.type === 'BITER') {
            ctx.rotate(-(this.angle + Math.PI/2));
            let p = this.timer/100;
            ctx.strokeStyle = `rgb(255, ${p*255}, 0)`;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(0, -35, 10, -Math.PI/2, (Math.PI*2*p) - Math.PI/2);
            ctx.stroke();
        } else if (this.type === 'EATER' && this.state !== 'LEAVING') {
            ctx.rotate(-(this.angle + Math.PI/2));
            ctx.fillStyle = '#4dff88';
            ctx.font = "bold 12px sans-serif";
            ctx.textAlign = "center";
            ctx.fillText(this.foodConsumed + "/6", 0, -40);
        }
        ctx.restore();
    }
}

