import 'dotenv/config';
import { OrderService } from './src/services/Order.service.js';
import { UserService } from './src/services/User.service.js';
import { PACKAGES } from './src/config.js';

// Симуляция реальной оплаты для тестирования
async function simulatePayment() {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🧪 Simulating Real Payment (10 generations package)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const orderService = new OrderService();
    const userService = new UserService();
    
    // Параметры
    const userId = 1323534384; // Ваш Telegram ID
    const packageKey = 'pack_10'; // Пакет на 10 генераций
    const pkg = PACKAGES[packageKey];
    
    if (!pkg) {
        console.error('❌ Package not found:', packageKey);
        return;
    }
    
    console.log('📦 Package:', pkg.title);
    console.log('💰 Price:', pkg.usdt, 'USDT');
    console.log('💎 Generations:', pkg.generations);
    console.log('👤 User ID:', userId);
    console.log('');
    
    // Шаг 1: Создаем заказ (как будто пользователь выбрал оплату)
    console.log('📝 Step 1: Creating order...');
    const orderId = orderService.generateOrderId('CRYPTO');
    
    const orderData = {
        orderId,
        userId,
        input: {
            merchantID: process.env.MERCHANT_ID || '0xMR8252827',
            billingID: orderId,
            currency: 'USDT (POLYGON)',
            email: `user${userId}@meemee.bot`,
            clientId: userId.toString(),
            amountUSD: pkg.usdt,
            amount: pkg.usdt,
            package: packageKey,
            payCurrency: 'USDT (POLYGON)',
            createdAt: new Date().toISOString()
        },
        output: {
            uid: `TEST-${Date.now()}`,
            id: `TEST-${Date.now()}`,
            paymentUrl: 'https://app.0xprocessing.com/payment/test',
            address: '0xTEST_ADDRESS_FOR_SIMULATION',
            expDate: new Date(Date.now() + 30 * 60 * 1000).toISOString()
        },
        isPaid: false,
        isFiat: false,
        package: packageKey,
        amount: pkg.usdt,
        currency: 'USDT (POLYGON)',
        crypto: 'USDT (POLYGON)',
        cryptoAmount: pkg.usdt
    };
    
    await orderService.createOrder(orderData);
    console.log(`✅ Order created: ${orderId}`);
    console.log('');
    
    // Шаг 2: Симулируем что пользователь отправил криптовалюту
    console.log('💸 Step 2: Simulating crypto payment...');
    console.log(`   User sends ${pkg.usdt} USDT to address`);
    console.log('   Transaction hash: 0xTEST_TRANSACTION_HASH');
    console.log('   Waiting for confirmation...');
    console.log('');
    
    // Ждем 2 секунды для реалистичности
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Шаг 3: Помечаем заказ как оплаченный
    console.log('✅ Step 3: Payment confirmed!');
    await orderService.markAsPaid(orderId);
    console.log(`   Order ${orderId} marked as paid`);
    console.log('');
    
    // Шаг 4: Добавляем генерации пользователю
    console.log('💎 Step 4: Adding generations to user...');
    const userBefore = await userService.getUser(userId);
    const quotaBefore = userBefore?.paid_quota || 0;
    
    await userService.addPaidQuota(userId, pkg.generations);
    
    const userAfter = await userService.getUser(userId);
    const quotaAfter = userAfter?.paid_quota || 0;
    
    console.log(`   Quota before: ${quotaBefore}`);
    console.log(`   Added: ${pkg.generations}`);
    console.log(`   Quota after: ${quotaAfter}`);
    console.log('');
    
    // Шаг 5: Проверяем результат
    console.log('🔍 Step 5: Verification...');
    const order = await orderService.getOrderById(orderId);
    
    if (order.isPaid) {
        console.log('✅ Order is marked as paid');
    } else {
        console.log('❌ Order is NOT marked as paid');
    }
    
    if (quotaAfter === quotaBefore + pkg.generations) {
        console.log('✅ Generations added correctly');
    } else {
        console.log('❌ Generations NOT added correctly');
    }
    
    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ Payment simulation completed successfully!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log('📋 Summary:');
    console.log(`   Order ID: ${orderId}`);
    console.log(`   Package: ${pkg.title}`);
    console.log(`   Amount: ${pkg.usdt} USDT`);
    console.log(`   Generations: ${pkg.generations}`);
    console.log(`   Status: ${order.isPaid ? 'PAID ✅' : 'UNPAID ❌'}`);
    console.log('');
    console.log('💡 Note: This is a SIMULATION. No real crypto was sent.');
    console.log('   To test with real payment, you need to:');
    console.log('   1. Create payment in Telegram bot');
    console.log('   2. Send real USDT to the address');
    console.log('   3. Wait for 0xprocessing to confirm');
    console.log('   4. Check payment status in bot');
}

simulatePayment().catch(console.error);
