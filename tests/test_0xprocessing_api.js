#!/usr/bin/env node

/**
 * Тест API 0xProcessing
 */

import 'dotenv/config';
import axios from 'axios';

const API_KEY = process.env.PAYMENT_API;
const MERCHANT_ID = process.env.MERCHANT_ID;

console.log('🔍 Тестирование 0xProcessing API\n');
console.log(`API Key: ${API_KEY?.substring(0, 30)}...`);
console.log(`Merchant ID: ${MERCHANT_ID}\n`);

const testData = {
    MerchantId: MERCHANT_ID,
    OrderId: `TEST-${Date.now()}`,
    Amount: 10,
    Currency: 'USDT (ERC20)',
    Email: 'test@test.com',
    Description: 'Test payment'
};

const endpoints = [
    { url: 'https://app.0xprocessing.com/api/invoice', method: 'POST' },
    { url: 'https://app.0xprocessing.com/Api/CreateInvoice', method: 'POST' },
    { url: 'https://api.0xprocessing.com/api/invoice', method: 'POST' },
];

async function testEndpoint(endpoint) {
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`Testing: ${endpoint.method} ${endpoint.url}`);
    console.log(`Data:`, JSON.stringify(testData, null, 2));
    
    try {
        const response = await axios({
            method: endpoint.method,
            url: endpoint.url,
            data: testData,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${API_KEY}`
            },
            timeout: 10000,
            validateStatus: () => true // Accept any status
        });
        
        console.log(`\n✅ Response received:`);
        console.log(`Status: ${response.status} ${response.statusText}`);
        console.log(`Content-Type: ${response.headers['content-type']}`);
        console.log(`Data:`, typeof response.data === 'string' ? response.data.substring(0, 200) : JSON.stringify(response.data, null, 2));
        
        return response;
    } catch (error) {
        console.log(`\n❌ Error:`);
        console.log(`Message: ${error.message}`);
        if (error.response) {
            console.log(`Status: ${error.response.status}`);
            console.log(`Data:`, error.response.data);
        }
        return null;
    }
}

async function main() {
    for (const endpoint of endpoints) {
        await testEndpoint(endpoint);
    }
    
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log('\n✅ Тестирование завершено');
}

main();
