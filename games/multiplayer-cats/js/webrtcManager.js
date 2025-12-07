// Менеджер WebRTC P2P соединений
import { networkState } from './networkState.js';
import { supabase } from './supabaseClient.js';

// Используем SimplePeer из глобальной области (загружен через CDN)
const SimplePeer = window.SimplePeer || window.simplePeer;

let peers = new Map(); // Map<playerId, peer>
let signalingChannel = null;
let syncCallbacks = [];

// Инициализация WebRTC сигналинга
export function initWebRTC(roomId) {
    if (signalingChannel) {
        supabase.removeChannel(signalingChannel);
    }

    // Подписываемся на WebRTC сигналы через Supabase
    signalingChannel = supabase
        .channel('webrtc_signaling_' + roomId)
        .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'webrtc_signals',
            filter: 'room_id=eq.' + roomId
        }, async (payload) => {
            await handleSignalingMessage(payload);
        })
        .subscribe();

    return signalingChannel;
}

// Обработка сигнальных сообщений
async function handleSignalingMessage(payload) {
    if (!payload.new) return;
    
    const signal = payload.new;
    
    // Игнорируем свои сигналы
    if (signal.from_player_id === networkState.playerId) {
        return;
    }

    // Если это сигнал для нас
    if (signal.to_player_id === networkState.playerId) {
        const fromPlayerId = signal.from_player_id;
        
        if (signal.signal_type === 'offer') {
            // Получили offer - создаем peer и отправляем answer
            await createPeerAsAnswerer(fromPlayerId, signal.signal_data);
        } else if (signal.signal_type === 'answer') {
            // Получили answer - устанавливаем соединение
            const peer = peers.get(fromPlayerId);
            if (peer) {
                try {
                    await peer.signal(JSON.parse(signal.signal_data));
                } catch (error) {
                    console.error('Ошибка установки answer:', error);
                }
            }
        } else if (signal.signal_type === 'ice-candidate') {
            // Получили ICE candidate
            const peer = peers.get(fromPlayerId);
            if (peer) {
                try {
                    await peer.signal(JSON.parse(signal.signal_data));
                } catch (error) {
                    console.error('Ошибка установки ICE candidate:', error);
                }
            }
        }
        
        // Удаляем обработанный сигнал
        await supabase
            .from('webrtc_signals')
            .delete()
            .eq('id', signal.id);
    }
}

// Создание peer как инициатор
export async function createPeerAsInitiator(targetPlayerId) {
    if (peers.has(targetPlayerId)) {
        return peers.get(targetPlayerId);
    }

    if (!SimplePeer) {
        console.error('SimplePeer не загружен! Проверьте подключение библиотеки.');
        return null;
    }

    const peer = new SimplePeer({
        initiator: true,
        trickle: false
    });

    setupPeer(peer, targetPlayerId);
    peers.set(targetPlayerId, peer);

    // Ждем сигнал и отправляем его
    peer.on('signal', async (data) => {
        await sendSignalingMessage(targetPlayerId, 'offer', JSON.stringify(data));
    });

    return peer;
}

// Создание peer как ответчик
async function createPeerAsAnswerer(fromPlayerId, offerData) {
    if (peers.has(fromPlayerId)) {
        return peers.get(fromPlayerId);
    }

    if (!SimplePeer) {
        console.error('SimplePeer не загружен! Проверьте подключение библиотеки.');
        return null;
    }

    const peer = new SimplePeer({
        initiator: false,
        trickle: false
    });

    setupPeer(peer, fromPlayerId);
    peers.set(fromPlayerId, peer);

    // Устанавливаем offer
    try {
        await peer.signal(JSON.parse(offerData));
    } catch (error) {
        console.error('Ошибка установки offer:', error);
    }

    // Отправляем answer
    peer.on('signal', async (data) => {
        await sendSignalingMessage(fromPlayerId, 'answer', JSON.stringify(data));
    });

    return peer;
}

// Настройка peer соединения
function setupPeer(peer, targetPlayerId) {
    peer.on('connect', () => {
        console.log('WebRTC соединение установлено с игроком:', targetPlayerId);
    });

    peer.on('data', (data) => {
        try {
            const event = JSON.parse(data.toString());
            // Вызываем все зарегистрированные колбэки
            syncCallbacks.forEach(callback => {
                try {
                    callback(event);
                } catch (error) {
                    console.error('Ошибка в callback WebRTC:', error);
                }
            });
        } catch (error) {
            console.error('Ошибка парсинга WebRTC данных:', error);
        }
    });

    peer.on('error', (error) => {
        console.error('Ошибка WebRTC peer:', error);
    });

    peer.on('close', () => {
        console.log('WebRTC соединение закрыто с игроком:', targetPlayerId);
        peers.delete(targetPlayerId);
    });
}

// Отправка сигнального сообщения через Supabase
async function sendSignalingMessage(toPlayerId, signalType, signalData) {
    if (!networkState.currentRoom) return;

    try {
        const { error } = await supabase
            .from('webrtc_signals')
            .insert([
                {
                    room_id: networkState.currentRoom.id,
                    from_player_id: networkState.playerId,
                    to_player_id: toPlayerId,
                    signal_type: signalType,
                    signal_data: signalData,
                    timestamp: new Date().toISOString()
                }
            ]);

        if (error) {
            console.error('Ошибка отправки сигнала:', error);
        }
    } catch (error) {
        console.error('Ошибка отправки сигнала:', error);
    }
}

// Отправка игрового события через WebRTC
export function sendGameEventViaWebRTC(eventType, eventData) {
    const event = {
        player_id: networkState.playerId,
        event_type: eventType,
        event_data: eventData,
        timestamp: Date.now()
    };

    // Отправляем всем подключенным пирам
    peers.forEach((peer, playerId) => {
        if (peer.connected) {
            try {
                peer.send(JSON.stringify(event));
            } catch (error) {
                console.error('Ошибка отправки через WebRTC:', error);
            }
        }
    });
}

// Подписка на события через WebRTC
export function onWebRTCEvent(callback) {
    syncCallbacks.push(callback);
    return () => {
        syncCallbacks = syncCallbacks.filter(cb => cb !== callback);
    };
}

// Установка соединений со всеми игроками в комнате
export async function connectToAllPlayers(players) {
    if (!networkState.currentRoom) return;

    // Хост создает соединения со всеми
    if (networkState.isHost) {
        for (const player of players) {
            if (player.player_id !== networkState.playerId) {
                // Небольшая задержка чтобы избежать одновременных попыток соединения
                setTimeout(() => {
                    createPeerAsInitiator(player.player_id);
                }, Math.random() * 500);
            }
        }
    }
    // Остальные игроки создают соединение только с хостом
    else {
        const host = players.find(p => p.is_host);
        if (host && host.player_id !== networkState.playerId) {
            setTimeout(() => {
                createPeerAsInitiator(host.player_id);
            }, 200);
        }
    }
}

// Остановка всех соединений
export function stopWebRTC() {
    peers.forEach((peer, playerId) => {
        peer.destroy();
    });
    peers.clear();
    syncCallbacks = [];

    if (signalingChannel) {
        supabase.removeChannel(signalingChannel);
        signalingChannel = null;
    }
}

// Получение статуса соединений
export function getConnectionStatus() {
    let connected = 0;
    peers.forEach((peer) => {
        if (peer.connected) connected++;
    });
    return { total: peers.size, connected };
}

