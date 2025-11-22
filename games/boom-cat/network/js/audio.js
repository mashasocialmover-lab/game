// Аудио система
import { gameState } from './gameState.js';

export function initAudio() {
    if (!gameState.audioContext) {
        gameState.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (gameState.audioContext.state === 'suspended') {
        gameState.audioContext.resume();
    }
}

export function playSound(type) {
    if (!gameState.audioContext) return;
    const osc = gameState.audioContext.createOscillator();
    const gainNode = gameState.audioContext.createGain();
    const now = gameState.audioContext.currentTime;
    
    if (type === 'bark') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.exponentialRampToValueAtTime(80, now + 0.1);
        gainNode.gain.setValueAtTime(0.2, now);
    }
    else if (type === 'swipe') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(400, now);
        osc.frequency.linearRampToValueAtTime(100, now + 0.1);
        gainNode.gain.setValueAtTime(0.3, now);
    }
    else if (type === 'squeak') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1200, now);
        gainNode.gain.setValueAtTime(0.1, now);
    }
    else if (type === 'hiss') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(800, now);
        gainNode.gain.setValueAtTime(0.1, now);
    }
    else if (type === 'whine') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(600, now);
        gainNode.gain.setValueAtTime(0.1, now);
    }
    else if (type === 'meow') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(400, now);
        gainNode.gain.setValueAtTime(0.1, now);
    }
    else if (type === 'eat') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(200, now);
        gainNode.gain.setValueAtTime(0.1, now);
    }
    else if (type === 'boom') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(100, now);
        osc.frequency.exponentialRampToValueAtTime(10, now + 0.5);
        gainNode.gain.setValueAtTime(0.5, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
    }
    else {
        osc.type = 'square';
        osc.frequency.setValueAtTime(150, now);
        gainNode.gain.setValueAtTime(0.05, now);
    }
    
    osc.connect(gainNode);
    gainNode.connect(gameState.audioContext.destination);
    osc.start();
    osc.stop(now + 0.5);
}

