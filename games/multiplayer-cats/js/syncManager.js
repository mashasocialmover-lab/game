// Менеджер синхронизации
import { networkState } from './networkState.js';
import { sendGameEventViaWebRTC, onWebRTCEvent } from './webrtcManager.js';
import { SYNC_INTERVAL } from './config.js';

let lastSyncTime = 0;
let syncCallbacks = [];

// Инициализация синхронизации
export function initSync(roomId) {
    // Подписываемся на события через WebRTC
    onWebRTCEvent(handleGameEvent);
}

// Обработка игрового события от другого игрока
function handleGameEvent(event) {
    // Игнорируем свои события
    if (event.player_id === networkState.playerId) return;

    // Вызываем все зарегистрированные колбэки
    syncCallbacks.forEach(callback => {
        try {
            callback(event);
        } catch (error) {
            console.error('Ошибка в callback синхронизации:', error);
        }
    });
}

// Подписка на игровые события
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
    
    sendGameEventViaWebRTC('player_move', {
        player_id: playerId,
        x: x,
        y: y,
        vx: vx,
        vy: vy
    });
}

// Синхронизация спавна игрока
export function syncPlayerSpawn(playerId, playerName, x, y, characterType) {
    sendGameEventViaWebRTC('player_spawn', {
        player_id: playerId,
        player_name: playerName,
        x: x,
        y: y,
        character_type: characterType
    });
}

// Остановка синхронизации
export function stopSync() {
    syncCallbacks = [];
}

