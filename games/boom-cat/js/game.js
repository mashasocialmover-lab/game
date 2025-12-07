// Основная логика игры
import { gameState } from './gameState.js';
import { COOLDOWN_MS } from './config.js';
import { updateGameArea } from './gameArea.js';
import { initAudio, playSound } from './audio.js';
import { updateLegendName } from './ui.js';
import { Aquarium } from './entities/Aquarium.js';
import { Mouse } from './entities/Mouse.js';
import { Dog } from './entities/Dog.js';
import { Cat } from './entities/Cat.js';
import { Item } from './entities/Item.js';

export function init() {
    updateGameArea();
    gameState.particleArray = [];
    gameState.aquarium = new Aquarium(gameState.gameArea.left + 50, gameState.gameArea.bottom - 50);
    let step = 25;
    for (let y = gameState.gameArea.top + 20; y < gameState.gameArea.bottom - 20; y += step) {
        for (let x = gameState.gameArea.left + 20; x < gameState.gameArea.right - 20; x += step) {
            gameState.particleArray.push(new Item(x, y));
        }
    }
}

export function animate() {
    updateGameArea();
    const ctx = gameState.ctx;
    ctx.clearRect(0, 0, gameState.canvas.width, gameState.canvas.height);
    
    // Рисуем границу игрового поля
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.strokeRect(gameState.gameArea.left, gameState.gameArea.top, gameState.gameArea.width, gameState.gameArea.height);
    ctx.setLineDash([]);
    
    if (Math.random() < 0.003 && gameState.audioContext && gameState.audioContext.state === 'running') {
        playSound('meow');
    }
    
    for (let i = gameState.footprints.length - 1; i >= 0; i--) {
        let fp = gameState.footprints[i];
        ctx.save();
        ctx.translate(fp.x, fp.y);
        ctx.rotate(fp.angle + Math.PI/2);
        ctx.fillStyle = `rgba(0,0,0, ${fp.life/300})`;
        if (fp.type === 'paw') {
            ctx.beginPath();
            ctx.arc(0, 0, 3, 0, Math.PI*2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(-3, -4, 1.5, 0, Math.PI*2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(3, -4, 1.5, 0, Math.PI*2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(0, -5, 1.5, 0, Math.PI*2);
            ctx.fill();
        } else {
            ctx.beginPath();
            ctx.ellipse(0, 0, 1, 2, 0, 0, Math.PI*2);
            ctx.fill();
        }
        ctx.restore();
        fp.life--;
        if (fp.life <= 0) gameState.footprints.splice(i, 1);
    }
    
    if (gameState.aquarium) gameState.aquarium.update();
    
    let allObjects = [...gameState.particleArray, ...gameState.miceArray, ...gameState.catsArray, ...gameState.dogsArray];
    if (gameState.aquarium) allObjects.push(gameState.aquarium);
    allObjects.sort((a, b) => a.y - b.y);
    
    allObjects.forEach(obj => {
        if (obj instanceof Cat) {
            obj.draw();
            obj.update();
            if (obj.markedForDeletion) {
                gameState.catsArray = gameState.catsArray.filter(c => c.id !== obj.id);
                if (gameState.playerEntity && gameState.playerEntity.id === obj.id) gameState.playerEntity = null;
            }
        }
        else if (obj instanceof Dog) {
            obj.draw();
            obj.update();
            if (obj.markedForDeletion) {
                gameState.dogsArray = gameState.dogsArray.filter(d => d.id !== obj.id);
                if (gameState.playerEntity && gameState.playerEntity.id === obj.id) gameState.playerEntity = null;
            }
        }
        else if (obj instanceof Mouse) {
            obj.draw();
            obj.update();
            if (obj.markedForDeletion) {
                gameState.miceArray = gameState.miceArray.filter(m => m.id !== obj.id);
            }
        }
        else if (obj instanceof Aquarium) {
            obj.draw();
        } else {
            obj.draw();
            obj.update();
        }
    });
    
    requestAnimationFrame(animate);
}

function getTargetEntity() {
    if (gameState.playerEntity) return gameState.playerEntity;
    let allEntities = [...gameState.catsArray, ...gameState.dogsArray];
    for (let i = allEntities.length - 1; i >= 0; i--) {
        let entity = allEntities[i];
        let dist = Math.sqrt((entity.x - gameState.mouse.x)**2 + (entity.y - gameState.mouse.y)**2);
        if (dist < 50) return entity;
    }
    return null;
}

function handleChangeSkin() {
    let target = getTargetEntity();
    if (target) {
        target.changeAppearance();
        playSound('bounce');
    }
}

export function setupEventListeners() {
    window.addEventListener('keydown', e => {
        if (gameState.keys.hasOwnProperty(e.code)) gameState.keys[e.code] = true;
        if (e.code === 'KeyR') handleChangeSkin();
        if (e.code === 'KeyC') window.changeCostume();
    });
    
    window.addEventListener('keyup', e => {
        if (gameState.keys.hasOwnProperty(e.code)) gameState.keys[e.code] = false;
    });
    
    window.togglePause = function() {
        gameState.isPaused = !gameState.isPaused;
        const btn = document.getElementById('pauseBtn');
        if (gameState.isPaused) {
            btn.innerHTML = "▶ ПРОДОЛЖИТЬ";
            btn.classList.add('paused');
        } else {
            btn.innerHTML = "⏸ СТОП";
            btn.classList.remove('paused');
        }
    };
    
    window.changeCostume = function() {
        let target = getTargetEntity();
        if (!target && gameState.catsArray.length > 0) {
            target = gameState.catsArray[Math.floor(Math.random() * gameState.catsArray.length)];
        }
        if (target && target instanceof Cat) {
            target.changeAccessory();
            playSound('bounce');
            let btn = document.getElementById('costumeBtn');
            btn.style.transform = "scale(0.8)";
            setTimeout(() => btn.style.transform = "scale(1)", 150);
            if (target.accessory === 'GLASSES') btn.innerText = '🕶️';
            else if (target.accessory === 'TOPHAT') btn.innerText = '🎩';
            else if (target.accessory === 'CROWN') btn.innerText = '👑';
            else if (target.accessory === 'BOW') btn.innerText = '🎀';
            else btn.innerText = '😺';
        }
    };
    
    window.clearAll = function() {
        gameState.catsArray = [];
        gameState.dogsArray = [];
        gameState.miceArray = [];
        gameState.footprints = [];
        gameState.playerEntity = null;
        gameState.particleArray.forEach(p => {
            p.eaten = false;
            p.size = (p.type === 'yarn') ? 5 : 3;
            p.respawnTimer = 0;
        });
    };
    
    window.spawnSpecific = function(type) {
        initAudio();
        updateGameArea();
        let x = gameState.gameArea.left + Math.random() * gameState.gameArea.width;
        let y = gameState.gameArea.top + Math.random() * gameState.gameArea.height;
        if (type === 'DOG') {
            let dog = new Dog(x, y);
            gameState.dogsArray.push(dog);
            updateLegendName('legend-dog', dog.name);
        }
        else if (type === 'MOUSE') {
            let mouse = new Mouse(x, y);
            gameState.miceArray.push(mouse);
            updateLegendName('legend-mouse', mouse.name);
        }
        else {
            let cat = new Cat(x, y, type);
            gameState.catsArray.push(cat);
            if (type === 'RUNNER') updateLegendName('legend-cat', cat.name);
        }
    };
    
    window.addEventListener('mousedown', e => {
        if (e.target.id !== 'canvas1') return;
        initAudio();
        updateGameArea();
        const currentTime = Date.now();
        const clickX = e.clientX;
        const clickY = e.clientY;
        
        // Проверка что клик внутри игровой области
        if (clickX < gameState.gameArea.left || clickX > gameState.gameArea.right ||
            clickY < gameState.gameArea.top || clickY > gameState.gameArea.bottom) {
            return;
        }
        
        let clickedObject = null;
        let allEntities = [...gameState.catsArray, ...gameState.dogsArray];
        for (let i = allEntities.length - 1; i >= 0; i--) {
            let entity = allEntities[i];
            let dist = Math.sqrt((entity.x - clickX)**2 + (entity.y - clickY)**2);
            if (dist < 45) {
                clickedObject = entity;
                break;
            }
        }
        if (clickedObject) {
            if (clickedObject.id === gameState.lastClickId && (currentTime - gameState.lastClickTime < 400)) {
                if (gameState.playerEntity) gameState.playerEntity.isPlayer = false;
                gameState.playerEntity = clickedObject;
                gameState.playerEntity.isPlayer = true;
                gameState.playerEntity.state = 'PLAYER_CONTROLLED';
                playSound('bounce');
                gameState.lastClickId = null;
                return;
            } else {
                gameState.lastClickId = clickedObject.id;
                gameState.lastClickTime = currentTime;
                return;
            }
        }
        if (currentTime - gameState.lastSpawnTime < COOLDOWN_MS) return;
        gameState.lastSpawnTime = currentTime;
        let rand = Math.random();
        if (rand < 0.03) {
            let dog = new Dog(clickX, clickY);
            gameState.dogsArray.push(dog);
            updateLegendName('legend-dog', dog.name);
        } else {
            let cat = new Cat(clickX, clickY);
            gameState.catsArray.push(cat);
            updateLegendName('legend-cat', cat.name);
        }
    });
    
    window.addEventListener('mousemove', e => {
        gameState.mouse.x = e.x;
        gameState.mouse.y = e.y;
    });
    
    window.addEventListener('resize', () => {
        gameState.canvas.width = window.innerWidth;
        gameState.canvas.height = window.innerHeight;
        updateGameArea();
        init();
    });
}


