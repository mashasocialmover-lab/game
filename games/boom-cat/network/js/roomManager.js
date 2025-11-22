// Управление комнатами
import { supabase } from './supabaseClient.js';
import { networkState } from './networkState.js';
import { MAX_PLAYERS } from './config.js';

// Генерация кода комнаты
function generateRoomCode() {
    return Math.random().toString(36).substr(2, 6).toUpperCase();
}

// Создание комнаты
export async function createRoom(roomName) {
    try {
        const roomCode = generateRoomCode();
        const { data, error } = await supabase
            .from('rooms')
            .insert([
                {
                    name: roomName || 'Комната ' + roomCode,
                    code: roomCode,
                    host_id: networkState.playerId,
                    max_players: MAX_PLAYERS,
                    current_players: 1,
                    status: 'waiting'
                }
            ])
            .select()
            .single();

        if (error) throw error;

        networkState.currentRoom = data;
        networkState.isHost = true;
        networkState.isConnected = true;

        // Добавляем себя в список игроков
        await addPlayerToRoom(data.id, networkState.playerId, networkState.playerName, true);

        return { success: true, room: data };
    } catch (error) {
        console.error('Ошибка создания комнаты:', error);
        return { success: false, error: error.message };
    }
}

// Присоединение к комнате
export async function joinRoom(roomCode) {
    try {
        // Находим комнату по коду
        const { data: room, error: roomError } = await supabase
            .from('rooms')
            .select('*')
            .eq('code', roomCode.toUpperCase())
            .eq('status', 'waiting')
            .single();

        if (roomError || !room) {
            throw new Error('Комната не найдена или игра уже началась');
        }

        if (room.current_players >= room.max_players) {
            throw new Error('Комната заполнена');
        }

        // Обновляем количество игроков
        const { error: updateError } = await supabase
            .from('rooms')
            .update({ current_players: room.current_players + 1 })
            .eq('id', room.id);

        if (updateError) throw updateError;

        networkState.currentRoom = { ...room, current_players: room.current_players + 1 };
        networkState.isHost = false;
        networkState.isConnected = true;

        // Добавляем себя в список игроков
        await addPlayerToRoom(room.id, networkState.playerId, networkState.playerName, false);

        return { success: true, room: networkState.currentRoom };
    } catch (error) {
        console.error('Ошибка присоединения к комнате:', error);
        return { success: false, error: error.message };
    }
}

// Добавление игрока в комнату
async function addPlayerToRoom(roomId, playerId, playerName, isHost) {
    const { error } = await supabase
        .from('players')
        .insert([
            {
                room_id: roomId,
                player_id: playerId,
                player_name: playerName,
                is_host: isHost
            }
        ]);

    if (error) {
        console.error('Ошибка добавления игрока:', error);
    }
}

// Получение списка игроков в комнате
export async function getRoomPlayers(roomId) {
    try {
        const { data, error } = await supabase
            .from('players')
            .select('*')
            .eq('room_id', roomId);

        if (error) throw error;

        networkState.connectedPlayers = data || [];
        return data || [];
    } catch (error) {
        console.error('Ошибка получения игроков:', error);
        return [];
    }
}

// Покинуть комнату
export async function leaveRoom() {
    if (!networkState.currentRoom) return;

    try {
        // Удаляем игрока из таблицы players
        await supabase
            .from('players')
            .delete()
            .eq('room_id', networkState.currentRoom.id)
            .eq('player_id', networkState.playerId);

        // Если хост покидает, удаляем комнату
        if (networkState.isHost) {
            await supabase
                .from('rooms')
                .delete()
                .eq('id', networkState.currentRoom.id);
        } else {
            // Уменьшаем счетчик игроков
            const { data } = await supabase
                .from('rooms')
                .select('current_players')
                .eq('id', networkState.currentRoom.id)
                .single();

            if (data) {
                await supabase
                    .from('rooms')
                    .update({ current_players: Math.max(0, data.current_players - 1) })
                    .eq('id', networkState.currentRoom.id);
            }
        }

        networkState.currentRoom = null;
        networkState.isHost = false;
        networkState.isConnected = false;
        networkState.connectedPlayers = [];
    } catch (error) {
        console.error('Ошибка выхода из комнаты:', error);
    }
}

// Начать игру (только для хоста)
export async function startGame() {
    if (!networkState.isHost || !networkState.currentRoom) return false;

    try {
        const { error } = await supabase
            .from('rooms')
            .update({ status: 'playing' })
            .eq('id', networkState.currentRoom.id);

        if (error) throw error;

        networkState.currentRoom.status = 'playing';
        return true;
    } catch (error) {
        console.error('Ошибка начала игры:', error);
        return false;
    }
}

// Подписка на изменения комнаты
export function subscribeToRoom(roomId, callback) {
    return supabase
        .channel('room_' + roomId)
        .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'rooms',
            filter: 'id=eq.' + roomId
        }, (payload) => {
            if (payload.new) {
                networkState.currentRoom = payload.new;
            }
            callback(payload);
        })
        .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'players',
            filter: 'room_id=eq.' + roomId
        }, async (payload) => {
            await getRoomPlayers(roomId);
            callback(payload);
        })
        .subscribe();
}

