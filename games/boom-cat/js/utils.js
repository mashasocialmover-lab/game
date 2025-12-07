// Утилиты
import { CAT_NAMES, DOG_NAMES, MOUSE_NAMES } from './config.js';

export function getRandomName(type) {
    if (type === 'CAT') return CAT_NAMES[Math.floor(Math.random() * CAT_NAMES.length)];
    if (type === 'DOG') return DOG_NAMES[Math.floor(Math.random() * DOG_NAMES.length)];
    if (type === 'MOUSE') return MOUSE_NAMES[Math.floor(Math.random() * MOUSE_NAMES.length)];
    return "Некто";
}

export function adjustColor(color, amount) {
    return color;
}


