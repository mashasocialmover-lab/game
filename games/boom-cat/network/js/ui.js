// UI функции
import { playSound } from './audio.js';
import { networkState } from './networkState.js';

export function showAchievement(text, icon = "🏆") {
    const box = document.getElementById('achievementBox');
    if (!box) return;
    const txt = document.getElementById('achText');
    const ico = document.querySelector('.ach-icon');
    if (txt) txt.innerText = text;
    if (ico) ico.innerText = icon;
    box.style.top = "20px";
    playSound('bounce');
    setTimeout(() => { box.style.top = "-150px"; }, 3000);
}

export function updateLegendName(legendId, name) {
    const legend = document.getElementById(legendId);
    if (legend) {
        const text = legend.innerText;
        const parts = text.split(' ');
        if (parts.length > 0) {
            const emoji = parts[0];
            const hp = text.match(/\(.*\)/);
            legend.innerText = `${emoji} ${name} ${hp ? hp[0] : ''}`;
        }
    }
}

export function drawHpBar(ctx, hp, maxHp) {
    let w = 40;
    let h = 6;
    let y = -55;
    ctx.fillStyle = 'red';
    ctx.fillRect(-w/2, y, w, h);
    ctx.fillStyle = '#00ff00';
    let hpW = (hp / maxHp) * w;
    if (hpW < 0) hpW = 0;
    ctx.fillRect(-w/2, y, hpW, h);
    ctx.strokeStyle = 'black';
    ctx.lineWidth = 1;
    ctx.strokeRect(-w/2, y, w, h);
}

// Сетевые UI функции
export function showRoomScreen() {
    const gameScreen = document.getElementById('gameScreen');
    const roomScreen = document.getElementById('roomScreen');
    if (gameScreen) gameScreen.style.display = 'none';
    if (roomScreen) roomScreen.style.display = 'block';
}

export function showGameScreen() {
    const gameScreen = document.getElementById('gameScreen');
    const roomScreen = document.getElementById('roomScreen');
    if (gameScreen) gameScreen.style.display = 'block';
    if (roomScreen) roomScreen.style.display = 'none';
}

export function updatePlayersList(players) {
    const playersList = document.getElementById('playersList');
    if (!playersList) return;
    
    playersList.innerHTML = '';
    players.forEach(player => {
        const li = document.createElement('li');
        li.textContent = player.player_name + (player.is_host ? ' (Хост)' : '');
        if (player.player_id === networkState?.playerId) {
            li.style.fontWeight = 'bold';
            li.style.color = '#4db8ff';
        }
        playersList.appendChild(li);
    });
}

export function updateConnectionStatus(isConnected) {
    const statusEl = document.getElementById('connectionStatus');
    if (statusEl) {
        statusEl.textContent = isConnected ? '🟢 Подключено' : '🔴 Отключено';
        statusEl.style.color = isConnected ? '#4dff88' : '#ff4d4d';
    }
}

