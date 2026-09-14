import { PaymentCryptoService } from '../src/services/PaymentCrypto.service.js';

const testPayments = async () => {
    console.log('🧪 Тестируем создание криптоплатежей...\n');
    
    const service = new PaymentCryptoService();
    
    // Тест 1: single пакет (1 видео) - должен работать
    console.log('📦 Тест 1: single (1 видео, 5.8 USDT)');
    const test1 = await service.createPayment({
        userId: 12345,
        amount: 5.8,
        payCurrency: 'USDT (TRC20)',
        package: 'single'
    });
    if (test1.error) {
        console.log('❌ Ошибка:', test1.error);
    } else {
        console.log('✅ Успешно создан orderId:', test1.orderId);
    }
    
    // Тест 2: pack_10 (10 видео) - раньше не работал
    console.log('\n📦 Тест 2: pack_10 (10 видео, 50 USDT)');
    const test2 = await service.createPayment({
        userId: 12345,
        amount: 50,
        payCurrency: 'USDT (TRC20)',
        package: 'pack_10'
    });
    if (test2.error) {
        console.log('❌ Ошибка:', test2.error);
    } else {
        console.log('✅ Успешно создан orderId:', test2.orderId);
    }
    
    // Тест 3: pack_100 (100 видео) - раньше не работал
    console.log('\n📦 Тест 3: pack_100 (100 видео, 400 USDT)');
    const test3 = await service.createPayment({
        userId: 12345,
        amount: 400,
        payCurrency: 'USDT (TRC20)',
        package: 'pack_100'
    });
    if (test3.error) {
        console.log('❌ Ошибка:', test3.error);
    } else {
        console.log('✅ Успешно создан orderId:', test3.orderId);
    }
    
    // Тест 4: pack_300 (300 видео) - раньше не работал
    console.log('\n📦 Тест 4: pack_300 (300 видео, 1000 USDT)');
    const test4 = await service.createPayment({
        userId: 12345,
        amount: 1000,
        payCurrency: 'USDT (TRC20)',
        package: 'pack_300'
    });
    if (test4.error) {
        console.log('❌ Ошибка:', test4.error);
    } else {
        console.log('✅ Успешно создан orderId:', test4.orderId);
    }
    
    console.log('\n✅ Тесты завершены!');
    process.exit(0);
};

testPayments().catch(err => {
    console.error('❌ Критическая ошибка:', err);
    process.exit(1);
});
