#!/usr/bin/env node

import 'dotenv/config';
import axios from 'axios';

const API_KEY = process.env.PAYMENT_API;
const MERCHANT_ID = process.env.MERCHANT_ID;

console.log('🔍 Поиск правильного URL для 0xProcessing API\n');

const testData = {
    merchant_id: MERCHANT_ID,
    order_id: `TEST-${Date.now()}`,
    amount: 10,
    currency: 'USDT',
    email: 'test@test.com'
};

// Все возможные комбинации
const domains = [
    'https://app.0xprocessing.com',
    'https://api.0xprocessing.com',
    'https://merchant.0xprocessing.com',
    'https://pay.0xprocessing.com',
    'https://0xprocessing.com'
];

const endpoints = [
    '/api/invoice',
    '/api/v1/invoice',
    '/api/create-invoice',
    '/Api/CreateInvoice',
    '/invoice/create',
    '/payment/create',
    '/api/payment',
    '/merchant/invoice'
];

let successCount = 0;

for (const domain of domains) {
    for (const endpoint of endpoints) {
        const url = `${domain}${endpoint}`;
        
        try {
            const response = await axios.post(url, testData, {
                headers: {
                    'Authorization': `Bearer ${API_KEY}`,
                    'Content-Type': 'application/json'
                },
                timeout: 5000,
                validateStatus: () => true
            });
            
            // Показываем только не-404 ответы
            if (response.status !== 404) {
                console.log(`\n✅ ${url}`);
                console.log(`   Status: ${response.status}`);
                console.log(`   Content-Type: ${response.headers['content-type']}`);
                
                if (response.status === 200 || response.status === 201) {
                    console.log(`   🎉 SUCCESS! Data:`, JSON.stringify(response.data, null, 2).substring(0, 200));
                    successCount++;
                } else if (!response.headers['content-type']?.includes('text/html')) {
                    console.log(`   Data:`, JSON.stringify(response.data, null, 2).substring(0, 200));
                }
            }
        } catch (error) {
            // Игнорируем ошибки подключения
        }
    }
}

console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
if (successCount > 0) {
    console.log(`\n🎉 Найдено ${successCount} рабочих endpoint(s)!`);
} else {
    console.log(`\n❌ Ни один endpoint не вернул успешный ответ`);
    console.log(`\nВозможные причины:`);
    console.log(`1. Аккаунт не активирован для API`);
    console.log(`2. API ключ неправильный`);
    console.log(`3. Нужна другая авторизация`);
    console.log(`\n💡 Рекомендация: свяжись с поддержкой 0xProcessing`);
}
