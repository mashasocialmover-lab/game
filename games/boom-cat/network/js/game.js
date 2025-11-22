// Основная логика сетевой игры
import { gameState } from './gameState.js';
import { networkState } from './networkState.js';
import { COOLDOWN_MS, SYNC_INTERVAL, MOUSE_SYNC_INTERVAL, ITEM_SYNC_INTERVAL } from './config.js';
import { updateGameArea } from './gameArea.js';
import { initAudio, playSound } from './audio.js';
import { updateLegendName, updatePlayersList, updateConnectionStatus } from './ui.js';
import { syncEntityPosition, syncEntityAction, syncEntitySpawn, syncEntityDelete, onGameEvent, initSync, stopSync } from './syncManager.js';
import { getRoomPlayers, subscribeToRoom } from './roomManager.js';
import { Aquarium } from './entities/Aquarium.js';
import { Mouse } from './entities/Mouse.js';
import { Dog } from './entities/Dog.js';
import { Cat } from './entities/Cat.js';
import { Item } from './entities/Item.js';

let lastSyncTime = 0;
let lastMouseSyncTime = 0;
let lastItemSyncTime = 0;
let roomSubscription = null;
let itemsInitialized = false;

// Seeded random для детерминированной генерации
function seededRandom(seed) {
    let value = parseInt(seed.replace(/-/g, '').substring(0, 10), 16) || 12345;
    return function() {
        value = (value * 9301 + 49297) % 233280;
        return value / 233280;
    };
}

export function init() {
    updateGameArea();
    gameState.particleArray = [];
    gameState.aquarium = new Aquarium(gameState.gameArea.left + 50, gameState.gameArea.bottom - 50);
    
    // Инициализация синхронизации
    if (networkState.currentRoom) {
        initSync(networkState.currentRoom.id);
        subscribeToRoomChanges();
        setupSyncHandlers();
        
        // Предметы будут созданы хостом при старте игры
        // Не создаем их здесь, чтобы не дублировать
    }
}

function createFixedItems() {
    if (!networkState.currentRoom) return;
    
    // Используем ID комнаты как seed для детерминированной генерации
    const seed = networkState.currentRoom.id;
    const rng = seededRandom(seed);
    const colors = ['#ff6b6b', '#4ecdc4', '#ffe66d', '#ff9ff3', '#54a0ff', '#5f27cd'];
    
    // 20 клубков
    for (let i = 0; i < 20; i++) {
        const x = gameState.gameArea.left + 20 + rng() * (gameState.gameArea.width - 40);
        const y = gameState.gameArea.top + 20 + rng() * (gameState.gameArea.height - 40);
        const item = new Item(x, y);
        item.id = 'yarn_' + i;
        item.type = 'yarn';
        item.size = 5;
        item.color = colors[Math.floor(rng() * colors.length)];
        item.baseX = x;
        item.baseY = y;
        // Убираем физику возврата
        item.returnSpeed = 0;
        gameState.particleArray.push(item);
        
        // Синхронизируем создание (только если игра уже началась)
        if (networkState.currentRoom.status === 'playing') {
            syncEntitySpawn('ITEM', x, y, { 
                entity_id: item.id, 
                item_type: 'yarn',
                color: item.color,
                size: 5
            });
        }
    }
    
    // 30 корма
    for (let i = 0; i < 30; i++) {
        const x = gameState.gameArea.left + 20 + rng() * (gameState.gameArea.width - 40);
        const y = gameState.gameArea.top + 20 + rng() * (gameState.gameArea.height - 40);
        const item = new Item(x, y);
        item.id = 'food_' + i;
        item.type = 'food';
        item.size = 3;
        item.color = '#8B4513';
        item.baseX = x;
        item.baseY = y;
        // Убираем физику возврата
        item.returnSpeed = 0;
        gameState.particleArray.push(item);
        
        // Синхронизируем создание (только если игра уже началась)
        if (networkState.currentRoom.status === 'playing') {
            syncEntitySpawn('ITEM', x, y, { 
                entity_id: item.id, 
                item_type: 'food',
                size: 3
            });
        }
    }
}

// Создание предметов для не-хоста (используя тот же seed)
export function createFixedItemsForClient() {
    if (!networkState.currentRoom || networkState.isHost) return;
    
    // Используем тот же seed что и хост
    const seed = networkState.currentRoom.id;
    const rng = seededRandom(seed);
    const colors = ['#ff6b6b', '#4ecdc4', '#ffe66d', '#ff9ff3', '#54a0ff', '#5f27cd'];
    
    // 20 клубков (те же позиции что у хоста)
    for (let i = 0; i < 20; i++) {
        const x = gameState.gameArea.left + 20 + rng() * (gameState.gameArea.width - 40);
        const y = gameState.gameArea.top + 20 + rng() * (gameState.gameArea.height - 40);
        const item = new Item(x, y);
        item.id = 'yarn_' + i;
        item.type = 'yarn';
        item.size = 5;
        item.color = colors[Math.floor(rng() * colors.length)];
        item.baseX = x;
        item.baseY = y;
        item.returnSpeed = 0;
        gameState.particleArray.push(item);
        gameState.remoteEntities.set(item.id, item);
    }
    
    // 30 корма (те же позиции что у хоста)
    for (let i = 0; i < 30; i++) {
        const x = gameState.gameArea.left + 20 + rng() * (gameState.gameArea.width - 40);
        const y = gameState.gameArea.top + 20 + rng() * (gameState.gameArea.height - 40);
        const item = new Item(x, y);
        item.id = 'food_' + i;
        item.type = 'food';
        item.size = 3;
        item.color = '#8B4513';
        item.baseX = x;
        item.baseY = y;
        item.returnSpeed = 0;
        gameState.particleArray.push(item);
        gameState.remoteEntities.set(item.id, item);
    }
    
    itemsInitialized = true;
}

function subscribeToRoomChanges() {
    if (!networkState.currentRoom) return;
    
    roomSubscription = subscribeToRoom(networkState.currentRoom.id, async (payload) => {
        if (payload.table === 'players') {
            await getRoomPlayers(networkState.currentRoom.id);
            updatePlayersList(networkState.connectedPlayers);
        }
        if (payload.table === 'rooms' && payload.new) {
            if (payload.new.status === 'playing' && networkState.currentRoom.status !== 'playing') {
                startNetworkGame();
            }
        }
    });
}

function setupSyncHandlers() {
    onGameEvent((event) => {
        if (event.player_id === networkState.playerId) return; // Игнорируем свои события
        
        switch(event.event_type) {
            case 'entity_move':
                handleRemoteEntityMove(event.event_data);
                break;
            case 'entity_action':
                handleRemoteEntityAction(event.event_data);
                break;
            case 'entity_spawn':
                handleRemoteEntitySpawn(event.event_data);
                break;
            case 'entity_delete':
                handleRemoteEntityDelete(event.event_data);
                break;
        }
    });
}

function handleRemoteEntityMove(data) {
    // Обновляем позицию удаленной сущности
    // НЕ обновляем если это наш персонаж
    if (gameState.playerEntity && data.entity_id === gameState.playerEntity.id) {
        return; // Игнорируем обновления своего персонажа
    }
    
    let entity = findEntityById(data.entity_id);
    if (entity) {
        // Плавная интерполяция для удаленных сущностей
        const lerp = 0.3; // Коэффициент интерполяции
        entity.x += (data.x - entity.x) * lerp;
        entity.y += (data.y - entity.y) * lerp;
        entity.angle = data.angle;
        entity.vx = data.vx || 0;
        entity.vy = data.vy || 0;
    }
}

function handleRemoteEntityAction(data) {
    let entity = findEntityById(data.entity_id);
    if (entity) {
        if (data.action_type === 'item_update') {
            // Обновление предмета (только хост обновляет предметы, остальные получают)
            if (entity instanceof Item) {
                if (!networkState.isHost) {
                    // Не-хост получает обновления предметов
                    const lerp = 0.5;
                    entity.x += (data.x - entity.x) * lerp;
                    entity.y += (data.y - entity.y) * lerp;
                    entity.vx = data.vx || 0;
                    entity.vy = data.vy || 0;
                    entity.eaten = data.eaten || false;
                    entity.size = data.size || entity.size;
                }
            }
        } else if (data.action_type === 'attack') {
            // Логика атаки
        }
    }
}

function handleRemoteEntitySpawn(data) {
    // Создаем сущность от другого игрока или хоста
    let entity = null;
    if (data.entity_type === 'CAT') {
        entity = new Cat(data.x, data.y, data.cat_type || null);
        entity.id = data.entity_id;
        if (data.name) entity.name = data.name;
        gameState.catsArray.push(entity);
    } else if (data.entity_type === 'DOG') {
        entity = new Dog(data.x, data.y);
        entity.id = data.entity_id;
        if (data.name) entity.name = data.name;
        gameState.dogsArray.push(entity);
    } else if (data.entity_type === 'MOUSE') {
        entity = new Mouse(data.x, data.y);
        entity.id = data.entity_id;
        if (data.name) entity.name = data.name;
        gameState.miceArray.push(entity);
    } else if (data.entity_type === 'ITEM') {
        // Создаем предмет от хоста
        entity = new Item(data.x, data.y);
        entity.id = data.entity_id;
        entity.type = data.item_type || 'yarn';
        entity.size = data.size || (data.item_type === 'food' ? 3 : 5);
        entity.color = data.color || (data.item_type === 'food' ? '#8B4513' : '#ff6b6b');
        entity.baseX = data.x;
        entity.baseY = data.y;
        entity.returnSpeed = 0; // Убираем физику возврата
        gameState.particleArray.push(entity);
    }
    
    if (entity) {
        gameState.remoteEntities.set(data.entity_id, entity);
    }
}

function handleRemoteEntityDelete(data) {
    let entity = findEntityById(data.entity_id);
    if (entity) {
        entity.markedForDeletion = true;
        gameState.remoteEntities.delete(data.entity_id);
    }
}

function findEntityById(id) {
    return gameState.remoteEntities.get(id) || 
           gameState.catsArray.find(e => e.id === id) ||
           gameState.dogsArray.find(e => e.id === id) ||
           gameState.miceArray.find(e => e.id === id) ||
           gameState.particleArray.find(e => e.id === id);
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
    
    // Синхронизация всех сущностей
    if (networkState.isConnected) {
        const now = Date.now();
        
        // Синхронизация персонажа игрока (каждые SYNC_INTERVAL)
        if (now - lastSyncTime > SYNC_INTERVAL) {
            if (gameState.playerEntity) {
                syncEntityPosition(
                    gameState.playerEntity.id,
                    gameState.playerEntity.x,
                    gameState.playerEntity.y,
                    gameState.playerEntity.angle,
                    gameState.playerEntity.vx || 0,
                    gameState.playerEntity.vy || 0
                );
            }
            lastSyncTime = now;
        }
        
        // Хост синхронизирует NPC и предметы реже
        if (networkState.isHost) {
            // Мыши - каждые MOUSE_SYNC_INTERVAL (реже чем персонажи)
            if (now - lastMouseSyncTime > MOUSE_SYNC_INTERVAL) {
                gameState.miceArray.forEach(mouse => {
                    syncEntityPosition(mouse.id, mouse.x, mouse.y, mouse.angle, mouse.vx || 0, mouse.vy || 0);
                });
                lastMouseSyncTime = now;
            }
            
            // Предметы - только раз в ITEM_SYNC_INTERVAL (они почти статичны)
            if (now - lastItemSyncTime > ITEM_SYNC_INTERVAL) {
                gameState.particleArray.forEach(item => {
                    if (item.id && !item.eaten) {
                        // Отправляем только если предмет двигался значительно
                        if (Math.abs(item.vx) > 0.1 || Math.abs(item.vy) > 0.1 || item.eaten) {
                            syncEntityAction(item.id, 'item_update', {
                                x: item.x,
                                y: item.y,
                                vx: item.vx || 0,
                                vy: item.vy || 0,
                                eaten: item.eaten,
                                size: item.size
                            });
                        }
                    }
                });
                lastItemSyncTime = now;
            }
        }
    }
    
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
            // Обновляем если:
            // 1. Это наш персонаж (obj.isPlayer && obj.id === gameState.playerEntity?.id)
            // 2. ИЛИ это NPC и мы хост (не игрок и хост)
            const isMyEntity = obj.isPlayer && gameState.playerEntity && obj.id === gameState.playerEntity.id;
            const isNPC = !obj.isPlayer && networkState.isHost;
            
            if (isMyEntity || isNPC) {
                obj.update();
            }
            obj.draw();
            if (obj.markedForDeletion) {
                gameState.catsArray = gameState.catsArray.filter(c => c.id !== obj.id);
                gameState.remoteEntities.delete(obj.id);
                if (gameState.playerEntity && gameState.playerEntity.id === obj.id) {
                    gameState.playerEntity = null;
                }
                // Синхронизируем удаление только если это наш персонаж или мы хост
                if (isMyEntity || networkState.isHost) {
                    syncEntityDelete(obj.id);
                }
            }
        }
        else if (obj instanceof Dog) {
            // Обновляем если:
            // 1. Это наш персонаж (obj.isPlayer && obj.id === gameState.playerEntity?.id)
            // 2. ИЛИ это NPC и мы хост (не игрок и хост)
            const isMyEntity = obj.isPlayer && gameState.playerEntity && obj.id === gameState.playerEntity.id;
            const isNPC = !obj.isPlayer && networkState.isHost;
            
            if (isMyEntity || isNPC) {
                obj.update();
            }
            obj.draw();
            if (obj.markedForDeletion) {
                gameState.dogsArray = gameState.dogsArray.filter(d => d.id !== obj.id);
                gameState.remoteEntities.delete(obj.id);
                if (gameState.playerEntity && gameState.playerEntity.id === obj.id) {
                    gameState.playerEntity = null;
                }
                // Синхронизируем удаление только если это наш персонаж или мы хост
                if (isMyEntity || networkState.isHost) {
                    syncEntityDelete(obj.id);
                }
            }
        }
        else if (obj instanceof Mouse) {
            // Обновляем только на хосте
            if (networkState.isHost) {
                obj.update();
            }
            obj.draw();
            if (obj.markedForDeletion) {
                gameState.miceArray = gameState.miceArray.filter(m => m.id !== obj.id);
                gameState.remoteEntities.delete(obj.id);
                if (networkState.isHost) {
                    syncEntityDelete(obj.id);
                }
            }
        }
        else if (obj instanceof Aquarium) {
            obj.draw();
        } else if (obj instanceof Item) {
            // Предметы обновляются только на хосте
            if (networkState.isHost) {
                obj.update();
            }
            obj.draw();
        } else {
            obj.draw();
            if (networkState.isHost || !gameState.remoteEntities.has(obj.id)) {
                obj.update();
            }
        }
    });
    
    // Обновление статуса подключения
    updateConnectionStatus(networkState.isConnected);
    
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

export function startNetworkGame() {
    // Инициализация сетевой игры
    if (networkState.currentRoom) {
        networkState.currentRoom.status = 'playing';
        initSync(networkState.currentRoom.id);
        setupSyncHandlers();
        
        // Хост создает предметы при старте игры
        if (networkState.isHost && !itemsInitialized) {
            createFixedItems();
            itemsInitialized = true;
        } else if (!networkState.isHost) {
            // Не-хост создает предметы локально (с тем же seed)
            // Проверяем, что предметы еще не созданы
            if (gameState.particleArray.length === 0) {
                createFixedItemsForClient();
            }
        }
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
        gameState.remoteEntities.clear();
        gameState.particleArray.forEach(p => {
            p.eaten = false;
            p.size = (p.type === 'yarn') ? 5 : 3;
            p.respawnTimer = 0;
        });
    };
    
    window.spawnSpecific = function(type) {
        if (!networkState.isConnected) {
            alert('Подключитесь к комнате для игры!');
            return;
        }
        initAudio();
        updateGameArea();
        let x = gameState.gameArea.left + Math.random() * gameState.gameArea.width;
        let y = gameState.gameArea.top + Math.random() * gameState.gameArea.height;
        if (type === 'DOG') {
            let dog = new Dog(x, y);
            dog.id = networkState.playerId + '_' + Date.now();
            gameState.dogsArray.push(dog);
            updateLegendName('legend-dog', dog.name);
            syncEntitySpawn('DOG', x, y, { entity_id: dog.id, name: dog.name });
        }
        else if (type === 'MOUSE') {
            let mouse = new Mouse(x, y);
            mouse.id = networkState.playerId + '_' + Date.now();
            gameState.miceArray.push(mouse);
            updateLegendName('legend-mouse', mouse.name);
            syncEntitySpawn('MOUSE', x, y, { entity_id: mouse.id, name: mouse.name });
        }
        else {
            let cat = new Cat(x, y, type);
            cat.id = networkState.playerId + '_' + Date.now();
            gameState.catsArray.push(cat);
            if (type === 'RUNNER') updateLegendName('legend-cat', cat.name);
            syncEntitySpawn('CAT', x, y, { entity_id: cat.id, name: cat.name, cat_type: type });
        }
    };
    
    window.addEventListener('mousedown', e => {
        if (e.target.id !== 'canvas1') return;
        if (!networkState.isConnected) return;
        initAudio();
        updateGameArea();
        const currentTime = Date.now();
        const clickX = e.clientX;
        const clickY = e.clientY;
        
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
                networkState.myEntityId = clickedObject.id;
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
            dog.id = networkState.playerId + '_' + Date.now();
            gameState.dogsArray.push(dog);
            updateLegendName('legend-dog', dog.name);
            syncEntitySpawn('DOG', clickX, clickY, { entity_id: dog.id, name: dog.name });
        } else {
            let cat = new Cat(clickX, clickY);
            cat.id = networkState.playerId + '_' + Date.now();
            gameState.catsArray.push(cat);
            updateLegendName('legend-cat', cat.name);
            syncEntitySpawn('CAT', clickX, clickY, { entity_id: cat.id, name: cat.name });
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

