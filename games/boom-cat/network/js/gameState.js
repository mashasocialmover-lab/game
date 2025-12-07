// Состояние игры (аналогично основной игре, но для сетевой версии)
export const gameState = {
    canvas: null,
    ctx: null,
    gameArea: {
        left: 100,
        right: 0,
        top: 0,
        bottom: 0,
        width: 0,
        height: 0
    },
    particleArray: [],
    footprints: [],
    catsArray: [],
    dogsArray: [],
    miceArray: [],
    audioContext: null,
    mouse: { x: null, y: null, radius: 150 },
    aquarium: null,
    gameStats: { miceCaught: 0, foodEaten: 0, swipes: 0, enemiesDefeated: 0 },
    isPaused: false,
    keys: { KeyW: false, KeyA: false, KeyS: false, KeyD: false, KeyE: false, KeyQ: false, KeyR: false, KeyC: false },
    playerEntity: null,
    lastSpawnTime: 0,
    lastClickTime: 0,
    lastClickId: null,
    // Сетевые данные
    remoteEntities: new Map(), // Сущности других игроков
    lastSyncTime: 0
};


