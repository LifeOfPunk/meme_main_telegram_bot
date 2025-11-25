import 'dotenv/config';
import redis from '../src/redis.js';
import { ReferralService } from '../src/services/Referral.service.js';
import { UserService } from '../src/services/User.service.js';

console.log('🧪 Тест: Referral Service (реферальная система)\n');

const referralService = new ReferralService();
const userService = new UserService();

async function testReferralService() {
    try {
        const referrerId = 111222333;
        const newUserId = 444555666;
        const expertId = 777888999;
        const referralUserId = 101102103;
        
        console.log('1️⃣ Тест пользовательской реферальной программы\n');
        
        // Создаём пользователей
        await userService.createUser({ id: referrerId, username: 'referrer_user' });
        await userService.createUser({ id: newUserId, username: 'new_user' });
        
        console.log('   👥 Пользователи созданы');
        
        // Обрабатываем реферальную регистрацию
        const result = await referralService.processReferral(referrerId, newUserId);
        
        if (result.success) {
            console.log('   ✅ Реферальная регистрация обработана');
            console.log(`   🎁 Бонус рефереру: ${result.bonusReferrer} генераций`);
            console.log(`   🎁 Бонус новому: ${result.bonusReferee} генераций`);
            
            const referrerBalance = await userService.getUser(referrerId);
            const newUserBalance = await userService.getUser(newUserId);
            
            console.log(`   💰 Баланс реферера: ${referrerBalance.free_quota} free`);
            console.log(`   💰 Баланс нового: ${newUserBalance.free_quota} free`);
        }
        
        console.log('\n2️⃣ Тест защиты от самореферала\n');
        
        const selfReferral = await referralService.processReferral(referrerId, referrerId);
        
        if (!selfReferral.success) {
            console.log('   ✅ Самореферал заблокирован');
            console.log(`   📝 Причина: ${selfReferral.error}`);
        }
        
        console.log('\n3️⃣ Тест защиты от повторного использования\n');
        
        const duplicate = await referralService.processReferral(referrerId, newUserId);
        
        if (!duplicate.success) {
            console.log('   ✅ Повторное использование заблокировано');
            console.log(`   📝 Причина: ${duplicate.error}`);
        }
        
        console.log('\n4️⃣ Тест экспертной реферальной программы\n');
        
        await userService.createUser({ id: expertId, username: 'expert_user' });
        await userService.createUser({ id: referralUserId, username: 'referral_user' });
        
        console.log('   👥 Эксперт и реферал созданы');
        
        // Регистрируем эксперта
        await referralService.registerExpertReferral(expertId, referralUserId);
        console.log('   ✅ Реферал привязан к эксперту');
        
        console.log('\n5️⃣ Тест начисления кешбэка эксперту\n');
        
        const purchaseAmount = 580; // 580 рублей
        const cashback = await referralService.processExpertCashback(referralUserId, purchaseAmount);
        
        if (cashback) {
            console.log('   ✅ Кешбэк начислен');
            console.log(`   💰 Сумма покупки: ${cashback.originalAmount}₽`);
            console.log(`   💵 Кешбэк (${cashback.percent}%): ${cashback.amount.toFixed(2)}₽`);
            console.log(`   👤 Эксперт ID: ${cashback.expertId}`);
            
            const expertData = await userService.getUser(expertId);
            console.log(`   💼 Общий кешбэк эксперта: ${expertData.totalCashback?.toFixed(2) || 0}₽`);
        }
        
        console.log('\n6️⃣ Тест статистики рефералов\n');
        
        const referrals = await referralService.getReferrals(referrerId);
        console.log(`   ✅ Рефералов пользователя ${referrerId}: ${referrals.length}`);
        
        if (referrals.length > 0) {
            console.log('\n   Список рефералов:');
            referrals.forEach((ref, index) => {
                console.log(`   ${index + 1}. User ID: ${ref.referredUserId}`);
                console.log(`      Дата: ${new Date(ref.timestamp).toLocaleString('ru-RU')}`);
            });
        }
        
        console.log('\n7️⃣ Тест экспертных рефералов\n');
        
        const expertReferrals = await referralService.getExpertReferrals(expertId);
        console.log(`   ✅ Рефералов эксперта ${expertId}: ${expertReferrals.length}`);
        
        if (expertReferrals.length > 0) {
            console.log('\n   Список экспертных рефералов:');
            expertReferrals.forEach((ref, index) => {
                console.log(`   ${index + 1}. User ID: ${ref.referralUserId}`);
                console.log(`      Дата: ${new Date(ref.timestamp).toLocaleString('ru-RU')}`);
                console.log(`      Кешбэк: ${ref.totalCashback?.toFixed(2) || 0}₽`);
            });
        }
        
        console.log('\n8️⃣ Тест получения реферера\n');
        
        const referrerOfNew = await referralService.getReferrer(newUserId);
        if (referrerOfNew) {
            console.log(`   ✅ Реферер найден: ${referrerOfNew}`);
        }
        
        const expertOfReferral = await referralService.getExpertReferrer(referralUserId);
        if (expertOfReferral) {
            console.log(`   ✅ Эксперт найден: ${expertOfReferral}`);
        }
        
        console.log('\n9️⃣ Тест проверки подозрительной активности\n');
        
        // Симулируем много рефералов за день
        const testReferrerId = 999888777;
        await userService.createUser({ id: testReferrerId, username: 'suspicious_user' });
        
        for (let i = 0; i < 12; i++) {
            const fakeUserId = 200000000 + i;
            await userService.createUser({ id: fakeUserId, username: `fake_${i}` });
            await referralService.processReferral(testReferrerId, fakeUserId);
        }
        
        const isSuspicious = await referralService.checkSuspiciousActivity(testReferrerId);
        
        if (isSuspicious) {
            console.log('   ⚠️  Подозрительная активность обнаружена');
            console.log('   📊 Больше 10 рефералов за день');
        }
        
        console.log('\n✅ Все тесты реферальной системы пройдены успешно!\n');
        
        // Очистка тестовых данных
        const testUsers = [referrerId, newUserId, expertId, referralUserId, testReferrerId];
        for (const userId of testUsers) {
            await redis.del(`user:${userId}`);
            await redis.del(`user_referrer:${userId}`);
            await redis.del(`expert_referral:${userId}`);
        }
        await redis.del(`referrals:${referrerId}`);
        await redis.del(`expert_referrals:${expertId}`);
        await redis.del(`referrals:${testReferrerId}`);
        
        console.log('🧹 Тестовые данные очищены\n');
        
    } catch (err) {
        console.error('❌ Ошибка в тесте:', err.message);
        console.error(err.stack);
    } finally {
        await redis.quit();
    }
}

testReferralService();
