// Менеджер синхронизации состояния игры
import { supabase } from './supabaseClient.js';
import { networkState } from './networkState.js';
import { SYNC_INTERVAL } from './config.js';

let syncChannel = null;
let syncCallbacks = [];

// Инициализация синхронизации
export function initSync(roomId) {
    if (syncChannel) {
        supabase.removeChannel(syncChannel);
    }

    syncChannel = supabase
        .channel('game_sync_' + roomId)
        .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'game_events',
            filter: 'room_id=eq.' + roomId
        }, (payload) => {
            handleGameEvent(payload);
        })
        .subscribe();

    return syncChannel;
}

// Обработка игрового события
function handleGameEvent(payload) {
    // Игнорируем собственные события
    if (payload.new && payload.new.player_id === networkState.playerId) {
        return;
    }

    const event = payload.new || payload.old;
    if (!event) return;

    // Вызываем все зарегистрированные колбэки
    syncCallbacks.forEach(callback => {
        try {
            callback(event);
        } catch (error) {
            console.error('Ошибка в callback синхронизации:', error);
        }
    });
}

// Подписка на события синхронизации
export function onGameEvent(callback) {
    syncCallbacks.push(callback);
    return () => {
        syncCallbacks = syncCallbacks.filter(cb => cb !== callback);
    };
}

// Отправка события в игру
export async function sendGameEvent(eventType, eventData) {
    if (!networkState.currentRoom) return;

    try {
        const { error } = await supabase
            .from('game_events')
            .insert([
                {
                    room_id: networkState.currentRoom.id,
                    player_id: networkState.playerId,
                    event_type: eventType,
                    event_data: eventData,
                    timestamp: new Date().toISOString()
                }
            ]);

        if (error) {
            console.error('Ошибка отправки события:', error);
        }
    } catch (error) {
        console.error('Ошибка отправки события:', error);
    }
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
    if (syncChannel) {
        supabase.removeChannel(syncChannel);
        syncChannel = null;
    }
    syncCallbacks = [];
}

