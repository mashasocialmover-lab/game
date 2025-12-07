// Менеджер WebSocket соединений через PeerJS
import { networkState } from './networkState.js';
import { supabase } from './supabaseClient.js';

let peer = null;
let connections = new Map(); // Map<playerId, DataConnection>
let syncCallbacks = [];

// Инициализация PeerJS
export function initPeerJS(roomId) {
    console.log('🔌 Инициализация PeerJS для комнаты:', roomId);
    console.log('👤 Используем playerId как peerId:', networkState.playerId);
    
    return new Promise((resolve, reject) => {
        // Проверяем что Peer доступен глобально
        const PeerToUse = window.Peer;
        if (!PeerToUse) {
            console.error('❌ PeerJS не загружен! Проверка window.Peer:', typeof window.Peer);
            console.error('Проверка window:', Object.keys(window).filter(k => k.toLowerCase().includes('peer')));
            
            // Пытаемся подождать немного и проверить снова
            setTimeout(() => {
                const PeerToUseRetry = window.Peer;
                if (!PeerToUseRetry) {
                    const error = new Error('PeerJS не загружен! Проверьте подключение библиотеки в index.html');
                    console.error('❌', error.message);
                    reject(error);
                } else {
                    console.log('✅ PeerJS загружен после задержки');
                    createPeer(PeerToUseRetry, resolve, reject);
                }
            }, 500);
            return;
        }
        
        createPeer(PeerToUse, resolve, reject);
    });
}

function createPeer(PeerToUse, resolve, reject) {
    if (peer) {
        console.log('🔄 Уничтожаем существующий peer');
        peer.destroy();
    }
    
    console.log('📡 Создание Peer с ID:', networkState.playerId);
    console.log('📚 PeerJS класс найден:', typeof PeerToUse);
    
    // Используем playerId как peerId для PeerJS
    peer = new PeerToUse(networkState.playerId, {
        host: '0.peerjs.com',
        port: 443,
        path: '/',
        secure: true,
        config: {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' }
            ]
        }
    });
    
    peer.on('open', (id) => {
        console.log('✅ PeerJS подключен, ID:', id);
        console.log('📊 Статус peer:', peer.open ? 'открыт' : 'закрыт');
        resolve(id);
    });
    
        peer.on('error', (error) => {
            console.error('❌ PeerJS ошибка:', error);
            console.error('Тип ошибки:', error.type);
            console.error('Сообщение:', error.message);
            
            // Некоторые ошибки не критичны - продолжаем работу
            if (error.type === 'peer-unavailable') {
                console.warn('⚠️ Peer недоступен, но продолжаем работу');
                // Не reject, чтобы не ломать игру
            } else if (error.type === 'network' || error.type === 'server-error') {
                console.warn('⚠️ Проблема с сетью, но продолжаем');
            } else {
                // Критические ошибки
                reject(error);
            }
        });
    
    // Ожидаем входящие соединения
    peer.on('connection', (conn) => {
        console.log('📥 Входящее соединение от:', conn.peer);
        console.log('📊 Соединение открыто:', conn.open);
        setupConnection(conn, conn.peer);
    });
    
    console.log('⏳ Ожидание подключения PeerJS...');
}

// Установка соединения с другим игроком (с retry)
let connectionAttempts = new Map(); // Map<playerId, attempts>

export function connectToPlayer(targetPlayerId, retryCount = 0) {
    if (!peer || !peer.open) {
        console.error('❌ Peer не готов, попытка:', retryCount);
        if (retryCount < 3) {
            setTimeout(() => connectToPlayer(targetPlayerId, retryCount + 1), 1000);
        }
        return;
    }
    
    if (connections.has(targetPlayerId)) {
        console.log('✅ Соединение уже существует с:', targetPlayerId);
        return;
    }
    
    // Проверяем количество попыток
    const attempts = connectionAttempts.get(targetPlayerId) || 0;
    if (attempts > 5) {
        console.warn('⚠️ Превышено количество попыток подключения к:', targetPlayerId);
        return;
    }
    connectionAttempts.set(targetPlayerId, attempts + 1);
    
    console.log('🔗 Подключение к игроку:', targetPlayerId, `(попытка ${attempts + 1})`);
    
    try {
        const conn = peer.connect(targetPlayerId, {
            reliable: true,
            serialization: 'json'
        });
        
        setupConnection(conn, targetPlayerId, retryCount);
    } catch (error) {
        console.error('❌ Ошибка создания соединения:', error);
        if (retryCount < 3) {
            setTimeout(() => connectToPlayer(targetPlayerId, retryCount + 1), 2000);
        }
    }
}

// Настройка соединения
function setupConnection(conn, playerId, retryCount = 0) {
    const timeout = setTimeout(() => {
        if (!conn.open) {
            console.warn('⏱️ Таймаут подключения к', playerId);
            if (retryCount < 3) {
                console.log('🔄 Повторная попытка подключения...');
                setTimeout(() => connectToPlayer(playerId, retryCount + 1), 2000);
            }
        }
    }, 10000); // 10 секунд таймаут
    
    conn.on('open', () => {
        clearTimeout(timeout);
        console.log('✅ Соединение установлено с:', playerId);
        connections.set(playerId, conn);
        connectionAttempts.delete(playerId); // Сбрасываем счетчик при успехе
        
        // Запрашиваем информацию о других игроках
        setTimeout(() => {
            import('./syncManager.js').then(({ requestOtherPlayersSpawn }) => {
                requestOtherPlayersSpawn();
            });
        }, 500);
    });
    
    conn.on('data', (data) => {
        try {
            const event = typeof data === 'string' ? JSON.parse(data) : data;
            if (event.player_id !== networkState.playerId) {
                console.log('📨 Получено событие от', playerId, ':', event.event_type);
                handleGameEvent(event);
            }
        } catch (error) {
            console.error('Ошибка обработки данных:', error);
        }
    });
    
    conn.on('close', () => {
        console.log('🔌 Соединение закрыто с:', playerId);
        connections.delete(playerId);
        clearTimeout(timeout);
    });
    
    conn.on('error', (error) => {
        console.error('❌ Ошибка соединения с', playerId, ':', error);
        clearTimeout(timeout);
        
        // Retry при ошибке подключения
        if (retryCount < 3 && error.type !== 'peer-unavailable') {
            console.log('🔄 Повторная попытка через 3 секунды...');
            setTimeout(() => connectToPlayer(playerId, retryCount + 1), 3000);
        }
    });
}

// Обработка игрового события
function handleGameEvent(event) {
    syncCallbacks.forEach(callback => {
        try {
            callback(event);
        } catch (error) {
            console.error('Ошибка в callback:', error);
        }
    });
}

// Отправка игрового события
export function sendGameEvent(eventType, eventData) {
    if (!peer) {
        console.warn('⚠️ Peer не создан');
        return 0;
    }
    
    if (!peer.open) {
        console.warn('⚠️ Peer не открыт, статус:', peer.destroyed ? 'уничтожен' : 'закрыт');
        return 0;
    }
    
    const event = {
        player_id: networkState.playerId,
        event_type: eventType,
        event_data: eventData,
        timestamp: Date.now()
    };
    
    let sentCount = 0;
    const totalConnections = connections.size;
    
    console.log(`📤 Отправка события ${eventType}, соединений: ${totalConnections}`);
    
    if (totalConnections === 0) {
        console.warn('⚠️ Нет активных соединений для отправки события');
    }
    
    connections.forEach((conn, playerId) => {
        if (conn.open) {
            try {
                conn.send(event);
                sentCount++;
                console.log(`✅ Отправлено к ${playerId}`);
            } catch (error) {
                console.error(`❌ Ошибка отправки к ${playerId}:`, error);
            }
        } else {
            console.warn(`⚠️ Соединение с ${playerId} не открыто`);
        }
    });
    
    if (sentCount === 0 && totalConnections > 0) {
        console.warn(`⚠️ Не удалось отправить событие никому из ${totalConnections} соединений`);
    }
    
    return sentCount;
}

// Подписка на события
export function onGameEvent(callback) {
    syncCallbacks.push(callback);
    return () => {
        syncCallbacks = syncCallbacks.filter(cb => cb !== callback);
    };
}

// Подключение ко всем игрокам в комнате
export async function connectToAllPlayers(players) {
    if (!networkState.currentRoom) {
        console.error('❌ Нет текущей комнаты');
        return;
    }
    
    console.log('🔗 Подключение ко всем игрокам, всего:', players.length);
    console.log('👤 Игроки:', players.map(p => p.player_id + (p.is_host ? ' (хост)' : '')));
    
    // Ждем пока PeerJS подключится
    if (!peer || !peer.open) {
        console.log('⏳ PeerJS не готов, инициализируем...');
        try {
            await initPeerJS(networkState.currentRoom.id);
            console.log('✅ PeerJS готов');
        } catch (error) {
            console.error('❌ Не удалось инициализировать PeerJS:', error);
            return;
        }
    }
    
    // Хост подключается ко всем
    if (networkState.isHost) {
        console.log('🏠 Хост: подключаемся ко всем игрокам');
        for (const player of players) {
            if (player.player_id !== networkState.playerId) {
                const delay = Math.random() * 1000 + 500; // 500-1500мс задержка
                console.log(`⏱️ Подключение к ${player.player_id} через ${delay.toFixed(0)}мс`);
                setTimeout(() => {
                    connectToPlayer(player.player_id);
                }, delay);
            }
        }
    } else {
        // Клиенты подключаются только к хосту
        const host = players.find(p => p.is_host);
        if (host && host.player_id !== networkState.playerId) {
            console.log('👤 Клиент: подключаемся к хосту', host.player_id);
            // Даем время хосту инициализироваться
            setTimeout(() => {
                connectToPlayer(host.player_id);
            }, 1000);
        } else {
            console.warn('⚠️ Хост не найден или это мы сами');
        }
    }
}

// Остановка всех соединений
export function stopPeerJS() {
    connections.forEach((conn) => {
        conn.close();
    });
    connections.clear();
    syncCallbacks = [];
    
    if (peer) {
        peer.destroy();
        peer = null;
    }
}

// Получение статуса соединений
export function getConnectionStatus() {
    let connected = 0;
    connections.forEach((conn) => {
        if (conn.open) connected++;
    });
    return { total: connections.size, connected };
}

