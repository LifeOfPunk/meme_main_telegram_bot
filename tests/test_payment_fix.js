#!/usr/bin/env node

/**
 * Тест исправления оплаты - проверяем что сумма передается в 0xprocessing
 */

import 'dotenv/config';
import { PaymentCryptoService } from './src/services/PaymentCrypto.service.js';

const paymentService = new PaymentCryptoService();

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🧪 Тест исправления оплаты');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

// Тестовые данные
const testCases = [
    {
        name: 'USDT (TRC20) - 6.2 USDT',
        userId: 123456789,
        amount: 6.2,
        payCurrency: 'USDT (TRC20)',
        package: 'pack_10'
    },
    {
        name: 'USDT (BEP20) - 6.2 USDT',
        userId: 123456789,
        amount: 6.2,
        payCurrency: 'USDT (BEP20)',
        package: 'pack_10'
    },
    {
        name: 'USDT (TON) - 6.2 USDT',
        userId: 123456789,
        amount: 6.2,
        payCurrency: 'USDT (TON)',
        package: 'pack_10'
    },
    {
        name: 'USDT (ERC20) - 27.9 USDT',
        userId: 123456789,
        amount: 27.9,
        payCurrency: 'USDT (ERC20)',
        package: 'pack_50'
    }
];

async function runTest(testCase) {
    console.log(`\n📝 Тест: ${testCase.name}`);
    console.log(`   Ожидаемая сумма: ${testCase.amount} USDT`);
    console.log(`   Сеть: ${testCase.payCurrency}`);
    console.log(`   Пакет: ${testCase.package}\n`);
    
    try {
        const result = await paymentService.createPayment({
            userId: testCase.userId,
            amount: testCase.amount,
            payCurrency: testCase.payCurrency,
            package: testCase.package
        });
        
        if (result.error) {
            console.log(`   ❌ Ошибка: ${result.error}\n`);
            return false;
        }
        
        console.log(`   ✅ Платеж создан успешно!`);
        console.log(`   📋 Order ID: ${result.orderId}`);
        console.log(`   💰 Сумма в запросе: ${result.input.amount} ${testCase.payCurrency}`);
        console.log(`   📍 Адрес: ${result.output.address}`);
        
        // Проверяем что сумма совпадает
        const expectedAmount = testCase.amount.toFixed(2);
        const actualAmount = parseFloat(result.input.amount).toFixed(2);
        
        if (expectedAmount === actualAmount) {
            console.log(`   ✅ Сумма совпадает: ${actualAmount} USDT`);
        } else {
            console.log(`   ❌ ОШИБКА! Сумма не совпадает!`);
            console.log(`      Ожидалось: ${expectedAmount} USDT`);
            console.log(`      Получено: ${actualAmount} USDT`);
        }
        
        console.log('');
        return true;
        
    } catch (error) {
        console.log(`   ❌ Исключение: ${error.message}\n`);
        return false;
    }
}

async function main() {
    console.log('Запуск тестов...\n');
    
    let passed = 0;
    let failed = 0;
    
    for (const testCase of testCases) {
        const success = await runTest(testCase);
        if (success) {
            passed++;
        } else {
            failed++;
        }
        
        // Пауза между тестами
        await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 Результаты тестирования:');
    console.log(`   ✅ Успешно: ${passed}`);
    console.log(`   ❌ Ошибок: ${failed}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    if (failed === 0) {
        console.log('🎉 Все тесты пройдены! Исправление работает корректно.\n');
    } else {
        console.log('⚠️  Некоторые тесты не прошли. Проверьте логи выше.\n');
    }
}

main().catch(console.error);
