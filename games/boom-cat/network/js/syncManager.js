// Менеджер синхронизации состояния игры (через WebRTC)
import { networkState } from './networkState.js';
import { sendGameEventViaWebRTC, onWebRTCEvent, initWebRTC, connectToAllPlayers, stopWebRTC } from './webrtcManager.js';

let syncCallbacks = [];

// Инициализация синхронизации через WebRTC
export function initSync(roomId) {
    // Инициализируем WebRTC сигналинг
    initWebRTC(roomId);
    
    // Подписываемся на события через WebRTC
    onWebRTCEvent((event) => {
        // Игнорируем собственные события
        if (event.player_id === networkState.playerId) {
            return;
        }

        // Вызываем все зарегистрированные колбэки
        syncCallbacks.forEach(callback => {
            try {
                callback(event);
            } catch (error) {
                console.error('Ошибка в callback синхронизации:', error);
            }
        });
    });

    return true;
}

// Подписка на события синхронизации
export function onGameEvent(callback) {
    syncCallbacks.push(callback);
    return () => {
        syncCallbacks = syncCallbacks.filter(cb => cb !== callback);
    };
}

// Отправка события в игру через WebRTC
export function sendGameEvent(eventType, eventData) {
    if (!networkState.currentRoom) return;
    
    // Отправляем напрямую через WebRTC (без батчинга - WebRTC быстрый)
    sendGameEventViaWebRTC(eventType, eventData);
}

// Принудительная отправка (для WebRTC не нужна, но оставляем для совместимости)
export function flushPendingEvents() {
    // WebRTC отправляет события сразу, батчинг не нужен
}

// Синхронизация позиции сущности
export function syncEntityPosition(entityId, x, y, angle, vx, vy) {
    sendGameEvent('entity_move', {
        entity_id: entityId,
        x: x,
        y: y,
        angle: angle,
        vx: vx,
        vy: vy
    });
}

// Синхронизация действия сущности
export function syncEntityAction(entityId, actionType, actionData) {
    sendGameEvent('entity_action', {
        entity_id: entityId,
        action_type: actionType,
        ...actionData
    });
}

// Синхронизация спавна сущности
export function syncEntitySpawn(entityType, x, y, entityData) {
    sendGameEvent('entity_spawn', {
        entity_type: entityType,
        x: x,
        y: y,
        ...entityData
    });
}

// Синхронизация удаления сущности
export function syncEntityDelete(entityId) {
    sendGameEvent('entity_delete', {
        entity_id: entityId
    });
}

// Остановка синхронизации
export function stopSync() {
    stopWebRTC();
    syncCallbacks = [];
}

