import 'dotenv/config';
import redis from '../src/redis.js';
import { OrderService } from '../src/services/Order.service.js';

console.log('🧪 Тест: Order Service (управление заказами)\n');

const orderService = new OrderService();

async function testOrderService() {
    try {
        const testUserId = 888777666;
        
        console.log('1️⃣ Тест создания крипто-заказа\n');
        
        const cryptoOrderId = orderService.generateOrderId('CRYPTO');
        console.log(`   📋 ID заказа: ${cryptoOrderId}`);
        
        const cryptoOrder = {
            orderId: cryptoOrderId,
            userId: testUserId,
            input: {
                currency: 'USDT (TRC20)',
                amount: 5.8
            },
            output: {
                address: 'TJnZ1234567890ABCDEF',
                amount: 5.8
            },
            isPaid: false,
            isFiat: false,
            package: 'single',
            amount: 5.8,
            currency: 'USDT (TRC20)'
        };
        
        await orderService.createOrder(cryptoOrder);
        console.log('   ✅ Крипто-заказ создан');
        console.log(`   💎 Валюта: ${cryptoOrder.currency}`);
        console.log(`   💰 Сумма: ${cryptoOrder.amount} USDT`);
        console.log(`   📦 Пакет: ${cryptoOrder.package}`);
        
        console.log('\n2️⃣ Тест создания фиат-заказа\n');
        
        const fiatOrderId = orderService.generateOrderId('FIAT');
        console.log(`   📋 ID заказа: ${fiatOrderId}`);
        
        const fiatOrder = {
            orderId: fiatOrderId,
            userId: testUserId,
            email: 'test@example.com',
            input: {
                offerId: 'LAVA_OFFER_123',
                currency: 'RUB'
            },
            output: {
                id: 'lava_payment_456',
                payUrl: 'https://lava.top/pay/123'
            },
            isPaid: false,
            isFiat: true,
            package: 'single',
            amount: 580
        };
        
        await orderService.createOrder(fiatOrder);
        console.log('   ✅ Фиат-заказ создан');
        console.log(`   📧 Email: ${fiatOrder.email}`);
        console.log(`   💵 Сумма: ${fiatOrder.amount}₽`);
        console.log(`   🔗 URL оплаты: ${fiatOrder.output.payUrl}`);
        
        console.log('\n3️⃣ Тест получения заказа\n');
        
        const fetchedOrder = await orderService.getOrderById(cryptoOrderId);
        console.log(`   ✅ Заказ получен: ${fetchedOrder.orderId}`);
        console.log(`   💳 Статус: ${fetchedOrder.isPaid ? 'Оплачен' : 'Не оплачен'}`);
        
        console.log('\n4️⃣ Тест отметки заказа как оплаченного\n');
        
        await orderService.markAsPaid(cryptoOrderId);
        const paidOrder = await orderService.getOrderById(cryptoOrderId);
        
        console.log(`   ✅ Заказ отмечен как оплаченный`);
        console.log(`   💳 Статус: ${paidOrder.isPaid ? 'Оплачен ✅' : 'Не оплачен ❌'}`);
        console.log(`   📅 Оплачен: ${new Date(paidOrder.paidAt).toLocaleString('ru-RU')}`);
        
        console.log('\n5️⃣ Тест получения заказов пользователя\n');
        
        const userOrders = await orderService.getUserOrders(testUserId);
        console.log(`   ✅ Заказов пользователя: ${userOrders.length}`);
        
        if (userOrders.length > 0) {
            console.log('\n   Список заказов:');
            userOrders.forEach((order, index) => {
                console.log(`   ${index + 1}. ${order.orderId} - ${order.isPaid ? '✅ Оплачен' : '⏳ Ожидает'} - ${order.amount}${order.isFiat ? '₽' : ' USDT'}`);
            });
        }
        
        console.log('\n6️⃣ Тест получения заказа по email и parentId\n');
        
        const orderByEmail = await orderService.getOrderByEmail('test@example.com');
        if (orderByEmail) {
            console.log(`   ✅ Заказ найден по email`);
            console.log(`   📋 Order ID: ${orderByEmail.orderId}`);
            console.log(`   📧 Email: ${orderByEmail.email}`);
        }

        const orderByParentId = await orderService.getOrderByParentId('lava_payment_456');
        if (orderByParentId) {
            console.log(`   ✅ Заказ найден по parentId (Lava invoiceId)`);
            console.log(`   📋 Order ID: ${orderByParentId.orderId}`);
        }
        
        console.log('\n7️⃣ Тест получения всех заказов\n');
        
        const allOrders = await orderService.getAllOrders();
        console.log(`   ✅ Всего заказов в базе: ${allOrders.length}`);
        
        const paidCount = allOrders.filter(o => o.isPaid).length;
        const unpaidCount = allOrders.filter(o => !o.isPaid).length;
        
        console.log(`   💰 Оплачено: ${paidCount}`);
        console.log(`   ⏳ Ожидает оплаты: ${unpaidCount}`);
        
        console.log('\n8️⃣ Тест статистики по методам оплаты\n');
        
        const cryptoOrders = allOrders.filter(o => !o.isFiat);
        const fiatOrders = allOrders.filter(o => o.isFiat);
        
        console.log(`   💎 Крипто-заказов: ${cryptoOrders.length}`);
        console.log(`   💵 Фиат-заказов: ${fiatOrders.length}`);
        
        console.log('\n✅ Все тесты заказов пройдены успешно!\n');
        
        // Очистка тестовых данных
        await redis.del(`order:${cryptoOrderId}`);
        await redis.del(`order:${fiatOrderId}`);
        await redis.lrem(`user_orders:${testUserId}`, 0, cryptoOrderId);
        await redis.lrem(`user_orders:${testUserId}`, 0, fiatOrderId);
        console.log('🧹 Тестовые данные очищены\n');
        
    } catch (err) {
        console.error('❌ Ошибка в тесте:', err.message);
        console.error(err.stack);
    } finally {
        await redis.quit();
    }
}

testOrderService();
