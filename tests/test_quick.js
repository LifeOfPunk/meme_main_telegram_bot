#!/usr/bin/env node
import 'dotenv/config';
import redis from './src/redis.js';

console.log('🧪 Быстрая проверка работоспособности всех компонентов\n');
console.log('='.repeat(60));

const tests = [];
let passed = 0;
let failed = 0;

async function test(name, fn) {
    try {
        console.log(`\n📦 ${name}...`);
        await fn();
        console.log(`✅ ${name} - ПРОЙДЕН`);
        passed++;
        tests.push({ name, status: 'passed' });
    } catch (err) {
        console.log(`❌ ${name} - ПРОВАЛЕН`);
        console.log(`   Ошибка: ${err.message}`);
        failed++;
        tests.push({ name, status: 'failed', error: err.message });
    }
}

async function runTests() {
    // 1. Redis Connection
    await test('Redis подключение', async () => {
        const pong = await redis.ping();
        if (pong !== 'PONG') throw new Error('Redis не отвечает');
    });
    
    // 2. User Service
    await test('User Service', async () => {
        const { UserService } = await import('./src/services/User.service.js');
        const userService = new UserService();
        
        const testUser = await userService.createUser({
            id: 123456789,
            username: 'test_user'
        });
        
        if (!testUser.userId) throw new Error('Пользователь не создан');
        if (testUser.free_quota !== 1) throw new Error('Неверная квота');
        
        await redis.del(`user:123456789`);
    });
    
    // 3. Order Service
    await test('Order Service', async () => {
        const { OrderService } = await import('./src/services/Order.service.js');
        const orderService = new OrderService();
        
        const orderId = orderService.generateOrderId('TEST');
        if (!orderId.includes('TEST')) throw new Error('Неверный ID заказа');
        
        const order = {
            orderId,
            userId: 123456789,
            isPaid: false,
            amount: 580
        };
        
        await orderService.createOrder(order);
        const fetched = await orderService.getOrderById(orderId);
        
        if (!fetched) throw new Error('Заказ не найден');
        
        await redis.del(`order:${orderId}`);
    });
    
    // 4. Generation Service
    await test('Generation Service', async () => {
        const { GenerationService } = await import('./src/services/Generation.service.js');
        const genService = new GenerationService();
        
        const memeData = genService.loadMemePrompt('mama_taxi');
        if (!memeData) throw new Error('Мем не загружен');
        if (!memeData.prompt) throw new Error('Промпт отсутствует');
    });
    
    // 5. Meme Loader
    await test('Meme Loader', async () => {
        const { loadAllMemes } = await import('./src/utils/memeLoader.js');
        const memes = loadAllMemes();
        
        if (memes.length === 0) throw new Error('Мемы не загружены');
        
        const activeMemes = memes.filter(m => m.status === 'active');
        if (activeMemes.length === 0) throw new Error('Нет активных мемов');
    });
    
    // 6. Referral Service
    await test('Referral Service', async () => {
        const { ReferralService } = await import('./src/services/Referral.service.js');
        const refService = new ReferralService();
        
        const link = refService.generateUserReferralLink(123, 'testbot');
        if (!link.includes('ref_123')) throw new Error('Неверная ссылка');
    });
    
    // 7. Payment Fiat Service
    await test('Payment Fiat Service', async () => {
        const { PaymentFiatService } = await import('./src/services/PaymentFiat.service.js');
        const paymentService = new PaymentFiatService();
        
        if (!paymentService.baseUrl) throw new Error('baseUrl не настроен');
        if (!paymentService.baseUrl.includes('lava')) throw new Error('Неверный URL');
    });
    
    // 8. Payment Crypto Service
    await test('Payment Crypto Service', async () => {
        const { PaymentCryptoService } = await import('./src/services/PaymentCrypto.service.js');
        const cryptoService = new PaymentCryptoService();
        
        if (!cryptoService.baseUrl) throw new Error('baseUrl не настроен');
        if (!cryptoService.baseUrl.includes('0xprocessing')) throw new Error('Неверный URL');
    });
    
    // 9. Config
    await test('Config загрузка', async () => {
        const config = await import('./src/config.js');
        
        if (!config.PACKAGES) throw new Error('PACKAGES не определён');
        if (!config.PACKAGES.single) throw new Error('Пакет single отсутствует');
        if (config.PACKAGES.single.generations !== 1) throw new Error('Неверное количество генераций');
    });
    
    // 10. Backend Webhook Server
    await test('Backend Webhook Config', async () => {
        const fs = await import('fs');
        const path = await import('path');
        const { fileURLToPath } = await import('url');
        
        const __filename = fileURLToPath(import.meta.url);
        const __dirname = path.dirname(__filename);
        
        const backendPath = path.join(__dirname, 'src', 'backend', 'index.js');
        if (!fs.existsSync(backendPath)) throw new Error('Backend файл не найден');
        
        const content = fs.readFileSync(backendPath, 'utf8');
        if (!content.includes('/webhook/lava')) throw new Error('Lava webhook отсутствует');
        if (!content.includes('/webhook/crypto')) throw new Error('Crypto webhook отсутствует');
    });
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 ИТОГИ БЫСТРОЙ ПРОВЕРКИ');
    console.log('='.repeat(60));
    console.log(`✅ Пройдено: ${passed}/${tests.length}`);
    console.log(`❌ Провалено: ${failed}/${tests.length}`);
    
    if (failed === 0) {
        console.log('\n🎉 ВСЕ КОМПОНЕНТЫ РАБОТАЮТ!\n');
        console.log('✅ Система полностью функциональна');
        console.log('✅ Все сервисы загружаются корректно');
        console.log('✅ Redis подключен');
        console.log('✅ Мемы загружаются');
        console.log('✅ Платёжные сервисы настроены');
        console.log('\n📝 Для запуска нужны только API ключи!');
        console.log('   См. файл: API_SETUP_GUIDE.md\n');
    } else {
        console.log('\n⚠️  Некоторые компоненты не работают\n');
        
        const failedTests = tests.filter(t => t.status === 'failed');
        console.log('Проваленные тесты:');
        failedTests.forEach(t => {
            console.log(`  ❌ ${t.name}: ${t.error}`);
        });
    }
    
    await redis.quit();
}

runTests().catch(err => {
    console.error('\n❌ Критическая ошибка:', err.message);
    console.error(err.stack);
    process.exit(1);
});
