// Менеджер синхронизации через PeerJS WebRTC
import { networkState } from './networkState.js';
import { sendGameEvent, onGameEvent as subscribeToWebSocketEvents, initPeerJS, connectToAllPlayers } from './websocketManager.js';
import { SYNC_INTERVAL } from './config.js';

let lastSyncTime = 0;
let syncCallbacks = [];

// Инициализация синхронизации
export function initSync(roomId) {
    console.log('🚀 Инициализация синхронизации для комнаты:', roomId);
    console.log('👤 Наш playerId:', networkState.playerId);
    
    // Инициализируем PeerJS
    initPeerJS(roomId).then((peerId) => {
        console.log('✅ PeerJS инициализирован, peerId:', peerId);
    }).catch((error) => {
        console.error('❌ Ошибка инициализации PeerJS:', error);
        console.error('Детали ошибки:', error.message, error.type);
    });
    
    // Подписываемся на события через PeerJS
    subscribeToWebSocketEvents(handleGameEvent);
    console.log('📝 Подписка на игровые события установлена');
}

// Обработка игрового события
function handleGameEvent(event) {
    // Игнорируем свои события
    if (event.player_id === networkState.playerId) {
        console.log('⚠️ Игнорируем свое событие:', event.event_type);
        return;
    }

    console.log('🔄 Обработка события:', event.event_type, 'от', event.player_id);

    // Вызываем все зарегистрированные колбэки
    syncCallbacks.forEach(callback => {
        try {
            callback(event);
        } catch (error) {
            console.error('❌ Ошибка в callback синхронизации:', error);
        }
    });
}

// Подписка на игровые события (для game.js)
export function onGameEvent(callback) {
    syncCallbacks.push(callback);
    return () => {
        syncCallbacks = syncCallbacks.filter(cb => cb !== callback);
    };
}

// Синхронизация позиции игрока
export function syncPlayerPosition(playerId, x, y, vx, vy) {
    const currentTime = Date.now();
    
    // Ограничиваем частоту отправки
    if (currentTime - lastSyncTime < SYNC_INTERVAL) {
        return;
    }
    
    lastSyncTime = currentTime;
    
    const sent = sendGameEvent('player_move', {
        player_id: playerId,
        x: x,
        y: y,
        vx: vx,
        vy: vy
    });
    
    if (sent === 0) {
        console.log('⚠️ Не удалось отправить позицию, соединений:', sent);
    }
}

// Синхронизация спавна игрока
export function syncPlayerSpawn(playerId, playerName, x, y, characterType) {
    console.log('📤 Отправка спавна через PeerJS:', playerName, x, y, characterType);
    sendGameEvent('player_spawn', {
        player_id: playerId,
        player_name: playerName,
        x: x,
        y: y,
        character_type: characterType
    });
}

// Запрос спавна других игроков
export function requestOtherPlayersSpawn() {
    console.log('📤 Запрос информации о других игроках через PeerJS');
    sendGameEvent('request_spawn', {});
}

// Остановка синхронизации
export function stopSync() {
    syncCallbacks = [];
    import('./websocketManager.js').then(({ stopPeerJS }) => {
        stopPeerJS();
    });
}

