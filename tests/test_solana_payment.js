#!/usr/bin/env node

import 'dotenv/config';
import { PaymentCryptoService } from './src/services/PaymentCrypto.service.js';

const paymentService = new PaymentCryptoService();

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🧪 Тест оплаты через Solana (USDT SOL)');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

async function testSolanaPayment() {
    try {
        console.log('📝 Создаем платеж...');
        console.log('  Сумма: 6.2 USDT');
        console.log('  Сеть: USDT (SOL)');
        console.log('  Пользователь: 123456789\n');

        const payment = await paymentService.createPayment({
            userId: 123456789,
            amount: 6.2,
            payCurrency: 'USDT (SOL)',
            package: 'pack_10'
        });

        if (payment.error) {
            console.log('❌ Ошибка:', payment.error);
            process.exit(1);
        }

        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('✅ Платеж создан успешно!');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        console.log('📋 Детали платежа:');
        console.log(`  Order ID: ${payment.orderId}`);
        console.log(`  Сумма: ${payment.input.amount} USDT (SOL)`);
        console.log(`  Адрес: ${payment.output.address || 'N/A'}`);
        console.log(`  Истекает: ${payment.output.expiredAt || 'N/A'}`);

        console.log('\n💡 Что проверить в 0xprocessing:');
        console.log('  1. Зайдите в панель 0xprocessing');
        console.log('  2. Найдите платеж по Order ID:', payment.orderId);
        console.log('  3. Проверьте что сумма = 6.20 USDT');
        console.log('  4. Проверьте что статус = Pending');
        console.log('  5. Проверьте что комиссия отображается');

        console.log('\n✅ Тест завершен!');
        process.exit(0);

    } catch (err) {
        console.error('\n❌ Ошибка:', err.message);
        console.error(err.stack);
        process.exit(1);
    }
}

testSolanaPayment();
