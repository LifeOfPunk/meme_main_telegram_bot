#!/usr/bin/env node

import 'dotenv/config';
import axios from 'axios';

const API_KEY = process.env.PAYMENT_API;
const MERCHANT_ID = process.env.MERCHANT_ID;

console.log('🔍 Тест 2: Разные варианты авторизации\n');

const testData = {
    merchant_id: MERCHANT_ID,
    order_id: `TEST-${Date.now()}`,
    amount: 10,
    currency: 'USDT',
    email: 'test@test.com'
};

const tests = [
    {
        name: 'С Bearer в Authorization',
        headers: {
            'Authorization': `Bearer ${API_KEY}`,
            'Content-Type': 'application/json'
        }
    },
    {
        name: 'С X-API-Key',
        headers: {
            'X-API-Key': API_KEY,
            'Content-Type': 'application/json'
        }
    },
    {
        name: 'С api_key в данных',
        headers: {
            'Content-Type': 'application/json'
        },
        data: { ...testData, api_key: API_KEY }
    }
];

for (const test of tests) {
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`Тест: ${test.name}`);
    
    try {
        const response = await axios.post(
            'https://app.0xprocessing.com/api/invoice',
            test.data || testData,
            {
                headers: test.headers,
                timeout: 10000,
                validateStatus: () => true
            }
        );
        
        console.log(`Status: ${response.status}`);
        console.log(`Content-Type: ${response.headers['content-type']}`);
        
        if (response.status !== 404) {
            console.log(`Data:`, JSON.stringify(response.data, null, 2).substring(0, 300));
        }
    } catch (error) {
        console.log(`Error: ${error.message}`);
    }
}

console.log('\n✅ Готово');
