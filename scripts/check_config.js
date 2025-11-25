import 'dotenv/config';

console.log('🔍 Проверка конфигурации API...\n');

// Проверка обязательных переменных
const requiredVars = {
    'BOT_TOKEN': process.env.BOT_TOKEN,
    'BOT_TOKEN_ADMIN': process.env.BOT_TOKEN_ADMIN,
    'KIE_AI_API_KEY': process.env.KIE_AI_API_KEY,
    'LAVA_PAYMENT_API': process.env.LAVA_PAYMENT_API,
    'PAYMENT_API': process.env.PAYMENT_API,
    'MERCHANT_ID': process.env.MERCHANT_ID,
    'SUPPORT_USERNAME': process.env.SUPPORT_USERNAME,
    'REDIS_URL': process.env.REDIS_URL
};

let hasErrors = false;

console.log('📋 Обязательные переменные окружения:\n');

for (const [key, value] of Object.entries(requiredVars)) {
    if (!value || value.includes('your_') || value.includes('here')) {
        console.log(`❌ ${key}: НЕ НАСТРОЕН`);
        hasErrors = true;
    } else {
        // Маскируем ключи для безопасности
        const masked = value.length > 10 
            ? value.substring(0, 8) + '...' + value.substring(value.length - 4)
            : '***';
        console.log(`✅ ${key}: ${masked}`);
    }
}

console.log('\n📦 Опциональные настройки:\n');

const optionalVars = {
    'REFERRAL_ENABLED': process.env.REFERRAL_ENABLED || 'false',
    'STARS_ENABLED': process.env.STARS_ENABLED || 'false',
    'FREE_QUOTA_PER_USER': process.env.FREE_QUOTA_PER_USER || '1',
    'EXPERT_REFERRAL_CASHBACK_PERCENT': process.env.EXPERT_REFERRAL_CASHBACK_PERCENT || '50'
};

for (const [key, value] of Object.entries(optionalVars)) {
    console.log(`ℹ️  ${key}: ${value}`);
}

// Проверка config.js
console.log('\n🔧 Проверка Lava Offer IDs:\n');

import { PACKAGES } from './src/config.js';

const offerErrors = [];

for (const [key, pkg] of Object.entries(PACKAGES)) {
    if (!pkg.offerIdLava || pkg.offerIdLava.includes('YOUR_')) {
        console.log(`❌ ${pkg.title}: Offer ID НЕ НАСТРОЕН`);
        offerErrors.push(key);
        hasErrors = true;
    } else {
        console.log(`✅ ${pkg.title}: ${pkg.offerIdLava}`);
    }
}

console.log('\n📊 Итоговый статус:\n');

if (hasErrors) {
    console.log('❌ КОНФИГУРАЦИЯ НЕПОЛНАЯ\n');
    console.log('Что нужно сделать:');
    console.log('1. Заполнить недостающие API ключи в .env файле');
    if (offerErrors.length > 0) {
        console.log('2. Добавить Lava Offer IDs в src/config.js');
    }
    console.log('\nПодробнее см. API_SETUP_GUIDE.md');
    process.exit(1);
} else {
    console.log('✅ ВСЕ НАСТРОЕНО ПРАВИЛЬНО!');
    console.log('\nМожно запускать бота:');
    console.log('  npm start          - основной бот');
    console.log('  npm run admin      - админ-бот');
    console.log('  npm run backend    - webhook сервер');
}
