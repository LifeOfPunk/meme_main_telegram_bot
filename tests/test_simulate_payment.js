#!/usr/bin/env node

/**
 * Скрипт для симуляции оплаты через webhook от 0xprocessing
 * Использование: node test_simulate_payment.js <orderId>
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import axios from 'axios';
import crypto from 'crypto';

// Загружаем .env вручную
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envPath = join(__dirname, '.env');

try {
    const envFile = readFileSync(envPath, 'utf8');
    envFile.split('\n').forEach(line => {
        const match = line.match(/^([^=:#]+)=(.*)$/);
        if (match) {
            const key = match[1].trim();
            const value = match[2].trim().replace(/^["']|["']$/g, '');
            process.env[key] = value;
        }
    });
} catch (err) {
    console.warn('⚠️ Could not load .env file:', err.message);
}

const WEBHOOK_URL = process.env.WEBHOOK_DOMAIN 
    ? `${process.env.WEBHOOK_DOMAIN}/webhook/crypto`
    : 'http://localhost:3000/webhook/crypto';

const WEBHOOK_PASSWORD = process.env.WEBHOOK_PASSWORD_PROCESSING;

// Получаем orderId из аргументов командной строки
const orderId = process.argv[2];

if (!orderId) {
    console.error('❌ Ошибка: Не указан orderId');
    console.log('\nИспользование:');
    console.log('  node test_simulate_payment.js <orderId>');
    console.log('\nПример:');
    console.log('  node test_simulate_payment.js CRYPTO-20251120-1234567890');
    process.exit(1);
}

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🧪 Симуляция оплаты через webhook 0xprocessing');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`📝 Order ID: ${orderId}`);
console.log(`🌐 Webhook URL: ${WEBHOOK_URL}`);
console.log(`🔐 Webhook Password: ${WEBHOOK_PASSWORD ? 'Present' : 'Missing'}`);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

// Данные webhook от 0xprocessing при успешной оплате
const webhookData = {
    orderId: orderId,
    status: 'success',
    amount: '10.00',
    currency: 'USDT',
    txHash: `0x${crypto.randomBytes(32).toString('hex')}`,
    timestamp: new Date().toISOString(),
    // Добавляем подпись если есть пароль
    ...(WEBHOOK_PASSWORD && {
        signature: crypto
            .createHash('md5')
            .update(`${orderId}${WEBHOOK_PASSWORD}`)
            .digest('hex')
    })
};

console.log('📤 Отправка webhook данных:');
console.log(JSON.stringify(webhookData, null, 2));
console.log('\n⏳ Отправка...\n');

try {
    const response = await axios.post(WEBHOOK_URL, webhookData, {
        headers: {
            'Content-Type': 'application/json',
            'User-Agent': '0xProcessing-Webhook/1.0'
        },
        timeout: 10000
    });

    console.log('✅ Webhook успешно отправлен!');
    console.log(`📥 Status: ${response.status}`);
    console.log(`📥 Response:`, response.data);
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ Оплата симулирована успешно!');
    console.log('💡 Проверьте бота - пользователь должен получить уведомление');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

} catch (error) {
    console.error('\n❌ Ошибка при отправке webhook:');
    console.error(`Message: ${error.message}`);
    
    if (error.response) {
        console.error(`Status: ${error.response.status}`);
        console.error(`Response:`, error.response.data);
    }
    
    console.log('\n💡 Возможные причины:');
    console.log('  1. Backend не запущен (запустите: npm run backend)');
    console.log('  2. Неправильный URL webhook');
    console.log('  3. Order ID не существует в базе данных');
    
    process.exit(1);
}
