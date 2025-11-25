import axios from 'axios';

console.log('🧪 Testing Crypto Webhook...\n');

const WEBHOOK_URL = 'http://localhost:3000/webhook/crypto';

// Тестовые данные в формате 0xProcessing
const testWebhookData = {
    PaymentId: 12369503,
    BillingID: 'CRYPTO-20251103-9730890680',
    MerchantId: '0xMR8252827',
    Status: 'Success',  // С большой буквы как в документации
    Amount: 2.5,
    AmountUSD: 2.5,
    Currency: 'USDT (BEP20)',
    TotalAmount: 2.5,
    TotalAmountUSD: 2.5
};

// Также тест с lowercase версией
const testWebhookDataLowercase = {
    paymentId: 12369503,
    billingID: 'CRYPTO-20251103-9730890680',
    merchantId: '0xMR8252827',
    status: 'success',  // lowercase
    amount: 2.5,
    amountUSD: 2.5,
    currency: 'USDT (BEP20)'
};

async function testWebhook() {
    try {
        console.log('📤 Test 1: Sending webhook with uppercase fields (0xProcessing format)...');
        console.log('Data:', JSON.stringify(testWebhookData, null, 2));
        
        const response1 = await axios.post(WEBHOOK_URL, testWebhookData, {
            headers: { 'Content-Type': 'application/json' }
        });
        
        console.log('✅ Response 1:', response1.status, response1.data);
        console.log('');

        console.log('📤 Test 2: Sending webhook with lowercase fields...');
        console.log('Data:', JSON.stringify(testWebhookDataLowercase, null, 2));
        
        const response2 = await axios.post(WEBHOOK_URL, testWebhookDataLowercase, {
            headers: { 'Content-Type': 'application/json' }
        });
        
        console.log('✅ Response 2:', response2.status, response2.data);
        console.log('');

        console.log('✅ All webhook tests passed!');

    } catch (err) {
        if (err.response) {
            console.error('❌ Webhook returned error:', err.response.status, err.response.data);
        } else {
            console.error('❌ Request failed:', err.message);
            console.error('⚠️  Make sure webhook server is running: node src/backend/index.js');
        }
        process.exit(1);
    }
}

// Запуск теста
testWebhook();
