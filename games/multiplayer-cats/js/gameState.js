// Состояние игры
export const gameState = {
    canvas: null,
    ctx: null,
    gameArea: {
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
        width: 0,
        height: 0
    },
    players: new Map(), // Map<playerId, Player>
    keys: {
        KeyW: false,
        KeyA: false,
        KeyS: false,
        KeyD: false
    },
    isPlaying: false
};

