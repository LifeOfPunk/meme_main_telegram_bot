#!/usr/bin/env node

/**
 * Проверка готовности системы к приему платежей
 */

import 'dotenv/config';
import axios from 'axios';

console.log('🔍 Проверка готовности системы к приему платежей\n');

// 1. Проверка переменных окружения
console.log('1️⃣ Проверка .env файла:');
const requiredEnvVars = [
    'BOT_TOKEN',
    'LAVA_PAYMENT_API',
    'KIE_AI_API_KEY'
];

let envOk = true;
for (const varName of requiredEnvVars) {
    const value = process.env[varName];
    if (value) {
        console.log(`   ✅ ${varName}: ${value.substring(0, 20)}...`);
    } else {
        console.log(`   ❌ ${varName}: НЕ НАСТРОЕН`);
        envOk = false;
    }
}

if (!envOk) {
    console.log('\n❌ Не все переменные настроены!');
    process.exit(1);
}

console.log('\n2️⃣ Проверка ngrok:');
try {
    const ngrokResponse = await axios.get('http://localhost:4040/api/tunnels');
    const publicUrl = ngrokResponse.data.tunnels[0]?.public_url;
    
    if (publicUrl) {
        console.log(`   ✅ ngrok работает: ${publicUrl}`);
        console.log(`\n📋 Webhook URLs для настройки в Lava:`);
        console.log(`   Lava: ${publicUrl}/webhook/lava`);
        console.log(`   Crypto: ${publicUrl}/webhook/crypto`);
    } else {
        console.log('   ❌ ngrok не вернул URL');
    }
} catch (error) {
    console.log('   ❌ ngrok не запущен или недоступен');
    console.log('   Запустите: ngrok http 3000');
}

console.log('\n3️⃣ Проверка backend:');
try {
    const backendResponse = await axios.get('http://localhost:3000/health');
    if (backendResponse.data.status === 'ok') {
        console.log('   ✅ Backend работает');
    }
} catch (error) {
    console.log('   ❌ Backend не отвечает');
    console.log('   Запустите: pm2 start meemee-backend');
}

console.log('\n4️⃣ Проверка бота:');
try {
    const botResponse = await axios.get(`https://api.telegram.org/bot${process.env.BOT_TOKEN}/getMe`);
    if (botResponse.data.ok) {
        console.log(`   ✅ Бот работает: @${botResponse.data.result.username}`);
    }
} catch (error) {
    console.log('   ❌ Бот не отвечает');
}

console.log('\n5️⃣ Проверка Lava API:');
try {
    const lavaResponse = await axios.get(
        'https://gate.lava.top/api/v2/products',
        {
            headers: {
                'X-Api-Key': process.env.LAVA_PAYMENT_API
            }
        }
    );
    
    if (lavaResponse.data.items) {
        console.log(`   ✅ Lava API работает`);
        console.log(`   📦 Найдено товаров: ${lavaResponse.data.items.length}`);
        
        const meemeeProducts = lavaResponse.data.items.filter(item => 
            item.title.toLowerCase().includes('meemee')
        );
        
        if (meemeeProducts.length > 0) {
            console.log(`   ✅ Товары MeeMee найдены: ${meemeeProducts.length}`);
            meemeeProducts.forEach(product => {
                console.log(`      - ${product.title} (${product.offers[0]?.id})`);
            });
        } else {
            console.log('   ⚠️  Товары MeeMee не найдены в Lava');
        }
    }
} catch (error) {
    console.log('   ❌ Lava API не отвечает');
    console.log(`   Ошибка: ${error.message}`);
}

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('\n✅ ИТОГ:');
console.log('   Если все пункты ✅ - система готова к приему платежей!');
console.log('   Если есть ❌ - исправьте проблемы выше');
console.log('\n⚠️  НЕ ЗАБУДЬТЕ:');
console.log('   1. Настроить webhook URL в Lava (см. выше)');
console.log('   2. Создать правильные Offer ID для всех пакетов');
console.log('   3. Протестировать платеж перед запуском');
console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

process.exit(0);
