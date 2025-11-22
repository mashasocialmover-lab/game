// Конфигурация сетевой игры
export const SUPABASE_URL = 'https://heopelxwmkzjwsfmsbjp.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhlb3BlbHh3bWt6andzZm1zYmpwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM4MTE2ODAsImV4cCI6MjA3OTM4NzY4MH0.k8RSL5bdPuhJV0mvn3TvDvAJWqOrGEQiSJuz9qXuwYg';

export const CAT_NAMES = ["Барсик", "Мурзик", "Рыжик", "Пушок", "Соня", "Багира", "Тигр", "Снежок", "Феликс", "Том", "Борис", "Кекс", "БАБАХ"];
export const DOG_NAMES = ["Рекс", "Шарик", "Бобик", "Мухтар", "Балто", "Джек", "Вольт", "Полкан", "Дружок", "Бим"];
export const MOUSE_NAMES = ["Джерри", "Пик", "Микки", "Шустрик", "Зернышко", "Хвост", "Стюарт", "Крош"];
export const COOLDOWN_MS = 1000;
export const MAX_PLAYERS = 4;
export const SYNC_INTERVAL = 200; // Интервал синхронизации в мс (увеличено для снижения нагрузки)
export const MOUSE_SYNC_INTERVAL = 300; // Интервал синхронизации мышей
export const ITEM_SYNC_INTERVAL = 1000; // Интервал синхронизации предметов (они почти статичны)
export const BATCH_INTERVAL = 150; // Интервал отправки батча событий
export const MAX_BATCH_SIZE = 20; // Максимум событий в батче

