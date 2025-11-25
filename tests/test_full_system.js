import 'dotenv/config';
import { ReferralService } from './src/services/Referral.service.js';
import { UserService } from './src/services/User.service.js';
import { OrderService } from './src/services/Order.service.js';

const referralService = new ReferralService();
const userService = new UserService();
const orderService = new OrderService();

async function testFullSystem() {
    console.log('🧪 ПОЛНАЯ ПРОВЕРКА СИСТЕМЫ\n');
    console.log('='.repeat(60));
    
    const testUserId = 1323534384;
    
    // Test 1: Проверка пользователя
    console.log('\n📋 Test 1: Проверка данных пользователя');
    console.log('-'.repeat(60));
    const user = await userService.getUser(testUserId);
    if (user) {
        console.log('✅ Пользователь найден:');
        console.log(`   ID: ${user.userId}`);
        console.log(`   Имя: ${user.firstName || 'не указано'}`);
        console.log(`   Username: @${user.username || 'нет'}`);
        console.log(`   🎁 Бесплатных генераций: ${user.free_quota || 0}`);
        console.log(`   💎 Платных генераций: ${user.paid_quota || 0}`);
        console.log(`   📊 Всего доступно: ${(user.free_quota || 0) + (user.paid_quota || 0)}`);
        console.log(`   ✅ Успешных генераций: ${user.successful_generations || 0}`);
        console.log(`   ❌ Ошибок: ${user.failed_generations || 0}`);
        console.log(`   💰 Потрачено: ${user.total_spent || 0}₽`);
        console.log(`   🔧 Эксперт: ${user.isExpert ? 'Да' : 'Нет'}`);
    } else {
        console.log('❌ Пользователь не найден');
    }
    
    // Test 2: Добавление генераций
    console.log('\n📋 Test 2: Добавление бесплатных генераций');
    console.log('-'.repeat(60));
    const oldQuota = user?.free_quota || 0;
    console.log(`   Было: ${oldQuota}`);
    
    await userService.addFreeQuota(testUserId, 5);
    const updatedUser = await userService.getUser(testUserId);
    const newQuota = updatedUser?.free_quota || 0;
    console.log(`   Добавлено: 5`);
    console.log(`   Стало: ${newQuota}`);
    
    if (newQuota === oldQuota + 5) {
        console.log('✅ Генерации добавлены корректно');
    } else {
        console.log('❌ Ошибка добавления генераций');
    }
    
    // Возвращаем обратно
    await userService.removeFreeQuota(testUserId, 5);
    console.log(`   Возвращено обратно: ${oldQuota}`);
    
    // Test 3: Реферальная статистика
    console.log('\n📋 Test 3: Реферальная статистика');
    console.log('-'.repeat(60));
    const refStats = await referralService.getReferralStats(testUserId);
    console.log(`   👥 Приглашено пользователей: ${refStats.referredUsers || 0}`);
    console.log(`   💼 Экспертных рефералов: ${refStats.expertReferrals || 0}`);
    console.log(`   💰 Заработано кэшбэка: ${(refStats.totalCashback || 0).toFixed(2)}₽`);
    
    // Test 4: Реферальные ссылки
    console.log('\n📋 Test 4: Реферальные ссылки');
    console.log('-'.repeat(60));
    const botName = process.env.BOT_NAME || 'meemee_bot';
    const userRefLink = `https://t.me/${botName}?start=ref_${testUserId}`;
    const expertRefLink = `https://t.me/${botName}?start=expert_${testUserId}`;
    console.log(`   👤 Обычная ссылка: ${userRefLink}`);
    console.log(`   💼 Экспертная ссылка: ${expertRefLink}`);
    
    // Test 5: Проверка экспертов
    console.log('\n📋 Test 5: Список экспертов');
    console.log('-'.repeat(60));
    const experts = await referralService.getAllExperts();
    console.log(`   Всего экспертов: ${experts.length}`);
    experts.forEach((expert, index) => {
        console.log(`   ${index + 1}. ID: ${expert.userId}, Имя: ${expert.firstName || 'нет'}, Username: @${expert.username || 'нет'}`);
    });
    
    // Test 6: Статистика платежей
    console.log('\n📋 Test 6: Статистика платежей');
    console.log('-'.repeat(60));
    const paymentStats = await orderService.getPaymentStats();
    console.log(`   💳 Всего заказов: ${paymentStats.total}`);
    console.log(`   ✅ Оплачено: ${paymentStats.paid}`);
    console.log(`   ⏳ В ожидании: ${paymentStats.unpaid}`);
    console.log(`   💎 Крипто: ${paymentStats.crypto}`);
    console.log(`   💵 Карты: ${paymentStats.fiat}`);
    console.log(`   💰 Выручка (карты): ${paymentStats.fiatRevenue.toFixed(2)}₽`);
    
    // Test 7: Проверка квоты
    console.log('\n📋 Test 7: Проверка наличия квоты');
    console.log('-'.repeat(60));
    const hasQuota = await userService.hasQuota(testUserId);
    console.log(`   Есть доступные генерации: ${hasQuota ? '✅ Да' : '❌ Нет'}`);
    
    // Test 8: Общая статистика
    console.log('\n📋 Test 8: Общая статистика системы');
    console.log('-'.repeat(60));
    const totalUsers = await userService.getTotalUsers();
    console.log(`   👥 Всего пользователей: ${totalUsers}`);
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ ВСЕ ТЕСТЫ ЗАВЕРШЕНЫ');
    console.log('='.repeat(60) + '\n');
    
    process.exit(0);
}

testFullSystem().catch(err => {
    console.error('❌ Test failed:', err);
    console.error(err.stack);
    process.exit(1);
});
