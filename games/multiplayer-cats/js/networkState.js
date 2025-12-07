// Состояние сетевой игры
export const networkState = {
    currentRoom: null,
    playerId: null,
    playerName: null,
    isHost: false,
    connectedPlayers: [],
    isConnected: false,
    myPlayerId: null, // ID нашего персонажа в игре
    selectedCharacter: null // 'cat' или 'dog'
};

// Генерация уникального ID игрока
export function generatePlayerId() {
    let playerId = localStorage.getItem('playerId');
    if (!playerId) {
        playerId = 'player_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('playerId', playerId);
    }
    return playerId;
}

// Получение имени игрока
export function getPlayerName() {
    let playerName = localStorage.getItem('playerName');
    if (!playerName) {
        playerName = 'Игрок_' + Math.random().toString(36).substr(2, 5).toUpperCase();
        localStorage.setItem('playerName', playerName);
    }
    return playerName;
}

// Инициализация сетевого состояния
export function initNetworkState() {
    networkState.playerId = generatePlayerId();
    networkState.playerName = getPlayerName();
}

