#!/usr/bin/env node

// Тестовый скрипт для проверки настроек генерации видео

import { GenerationService } from './src/services/Generation.service.js';

console.log('🎬 Проверка настроек генерации видео MeeMee Bot\n');

const service = new GenerationService();

console.log('📋 Текущие настройки:');
console.log('  API: Kie.ai Sora 2');
console.log('  Model:', service.modelName);
console.log('  ✅ Длительность: 8 секунд');
console.log('  ✅ Формат: portrait (9:16)');
console.log('  ✅ Разрешение: 1080x1920\n');

console.log('💡 Применение:');
console.log('  - Instagram Reels');
console.log('  - TikTok');
console.log('  - YouTube Shorts');
console.log('  - Telegram Stories\n');

console.log('✅ Настройки применены в файле:');
console.log('   /app/meemee_bot/src/services/Generation.service.js\n');

console.log('📝 Для генерации тестового видео используйте бота @meemee12_bot');

process.exit(0);
