// Менеджер синхронизации через Supabase Realtime
import { networkState } from './networkState.js';
import { supabase } from './supabaseClient.js';
import { SYNC_INTERVAL } from './config.js';

let lastSyncTime = 0;
let syncCallbacks = [];
let gameChannel = null;

// Инициализация синхронизации
export function initSync(roomId) {
    setupSupabaseRealtimeSync(roomId);
}

// Настройка синхронизации через Supabase Realtime
function setupSupabaseRealtimeSync(roomId) {
    if (gameChannel) {
        supabase.removeChannel(gameChannel);
    }
    
    gameChannel = supabase
        .channel('game_sync_' + roomId)
        .on('broadcast', {
            event: 'game_event'
        }, (payload) => {
            const event = payload.payload;
            if (event && event.player_id !== networkState.playerId) {
                console.log('✅ Получено событие:', event.event_type, 'от', event.player_id);
                handleGameEvent(event);
            }
        })
        .subscribe((status) => {
            console.log('📡 Game sync channel status:', status);
            if (status === 'SUBSCRIBED') {
                console.log('✅ Подписка на синхронизацию установлена');
            }
        });
}

// Отправка события через Supabase Realtime
function sendGameEvent(eventType, eventData) {
    if (!gameChannel) {
        console.warn('Game channel не готов');
        return false;
    }
    
    const event = {
        player_id: networkState.playerId,
        event_type: eventType,
        event_data: eventData,
        timestamp: Date.now()
    };
    
    gameChannel.send({
        type: 'broadcast',
        event: 'game_event',
        payload: event
    }).then(() => {
        console.log('📤 Отправлено событие:', eventType);
    }).catch((error) => {
        console.error('❌ Ошибка отправки события:', error);
    });
    
    return true;
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
    
    sendGameEvent('player_move', {
        player_id: playerId,
        x: x,
        y: y,
        vx: vx,
        vy: vy
    });
}

// Синхронизация спавна игрока
export function syncPlayerSpawn(playerId, playerName, x, y, characterType) {
    console.log('📤 Отправка спавна:', playerName, x, y, characterType);
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
    console.log('📤 Запрос информации о других игроках');
    sendGameEvent('request_spawn', {});
}

// Остановка синхронизации
export function stopSync() {
    syncCallbacks = [];
    if (gameChannel) {
        supabase.removeChannel(gameChannel);
        gameChannel = null;
    }
}

