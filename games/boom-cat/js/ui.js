// UI функции
import { playSound } from './audio.js';

export function showAchievement(text, icon = "🏆") {
    const box = document.getElementById('achievementBox');
    const txt = document.getElementById('achText');
    const ico = document.querySelector('.ach-icon');
    txt.innerText = text;
    ico.innerText = icon;
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

