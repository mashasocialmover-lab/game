// Менеджер синхронизации через Supabase Realtime
import { networkState } from './networkState.js';
import { supabase } from './supabaseClient.js';
import { SYNC_INTERVAL, BATCH_INTERVAL, MAX_BATCH_SIZE } from './config.js';

let lastSyncTime = 0;
let syncCallbacks = [];
let gameChannel = null;
let eventBatch = [];
let lastBatchTime = 0;

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

// Отправка события через Supabase Realtime (с батчингом)
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
    
    // Важные события (спавн, запросы) отправляем сразу
    if (eventType === 'player_spawn' || eventType === 'request_spawn') {
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
    
    // Позиции батчим для снижения нагрузки
    eventBatch.push(event);
    
    const currentTime = Date.now();
    const shouldFlush = 
        eventBatch.length >= MAX_BATCH_SIZE || 
        (currentTime - lastBatchTime >= BATCH_INTERVAL);
    
    if (shouldFlush) {
        flushBatch();
    }
    
    return true;
}

// Отправка батча событий
function flushBatch() {
    if (eventBatch.length === 0 || !gameChannel) return;
    
    // Отправляем все события одним батчем
    const batch = [...eventBatch];
    eventBatch = [];
    lastBatchTime = Date.now();
    
    // Отправляем последнее событие (самое актуальное)
    const lastEvent = batch[batch.length - 1];
    gameChannel.send({
        type: 'broadcast',
        event: 'game_event',
        payload: lastEvent
    }).catch((error) => {
        console.error('❌ Ошибка отправки батча:', error);
    });
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
    // Отправляем оставшиеся события перед остановкой
    flushBatch();
    
    syncCallbacks = [];
    if (gameChannel) {
        supabase.removeChannel(gameChannel);
        gameChannel = null;
    }
    eventBatch = [];
}

// Принудительная отправка батча (для использования при закрытии страницы)
export function flushPendingEvents() {
    flushBatch();
}

