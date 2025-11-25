import 'dotenv/config';
import { ReferralService } from '../src/services/Referral.service.js';
import { UserService } from '../src/services/User.service.js';
import redis from '../src/redis.js';

const referralService = new ReferralService();
const userService = new UserService();

async function testReferralFlow() {
    console.log('🧪 ТЕСТ РЕФЕРАЛЬНОЙ СИСТЕМЫ\n');
    console.log('='.repeat(70));
    
    // Используем реальных пользователей
    const referrerId = 1323534384; // Твой ID (реферер)
    const newUserId = Math.floor(Math.random() * 1000000000); // Случайный ID для теста
    
    console.log('\n📋 Шаг 1: Проверка начального состояния');
    console.log('-'.repeat(70));
    
    // Проверяем реферера ДО
    const referrerBefore = await userService.getUser(referrerId);
    console.log(`👤 Реферер (ID: ${referrerId}):`);
    console.log(`   Имя: ${referrerBefore?.firstName || 'нет'}`);
    console.log(`   🎁 Бесплатных генераций ДО: ${referrerBefore?.free_quota || 0}`);
    console.log(`   👥 Приглашено пользователей ДО: ${referrerBefore?.referredUsers?.length || 0}`);
    
    // Проверяем нового пользователя
    let newUser = await userService.getUser(newUserId);
    if (newUser) {
        console.log(`\n⚠️  Тестовый пользователь ${newUserId} уже существует, используем другой ID...`);
        // Генерируем новый ID
        const newRandomId = Math.floor(Math.random() * 1000000000);
        console.log(`   Новый ID: ${newRandomId}`);
        return testReferralFlow(); // Перезапускаем с новым ID
    }
    
    console.log('\n📋 Шаг 2: Создание нового пользователя');
    console.log('-'.repeat(70));
    
    // Создаем нового пользователя (симулируем /start с реферальной ссылкой)
    await userService.createUser({
        id: newUserId,
        first_name: 'Тестовый',
        last_name: 'Пользователь',
        username: 'test_user_999'
    }, `ref_${referrerId}`);
    
    newUser = await userService.getUser(newUserId);
    console.log(`✅ Новый пользователь создан (ID: ${newUserId})`);
    console.log(`   Имя: ${newUser?.firstName || 'нет'}`);
    console.log(`   🎁 Бесплатных генераций: ${newUser?.free_quota || 0}`);
    
    console.log('\n📋 Шаг 3: Обработка реферальной ссылки');
    console.log('-'.repeat(70));
    console.log(`🔗 Симулируем переход по ссылке: ?start=ref_${referrerId}`);
    
    // Обрабатываем реферал
    const success = await referralService.processReferral(referrerId, newUserId);
    
    if (success) {
        console.log('✅ Реферал успешно обработан!');
    } else {
        console.log('❌ Ошибка обработки реферала');
    }
    
    console.log('\n📋 Шаг 4: Проверка результатов');
    console.log('-'.repeat(70));
    
    // Проверяем реферера ПОСЛЕ
    const referrerAfter = await userService.getUser(referrerId);
    const referrerQuotaBefore = referrerBefore?.free_quota || 0;
    const referrerQuotaAfter = referrerAfter?.free_quota || 0;
    const quotaDiff = referrerQuotaAfter - referrerQuotaBefore;
    
    console.log(`👤 Реферер (ID: ${referrerId}):`);
    console.log(`   🎁 Бесплатных генераций ДО: ${referrerQuotaBefore}`);
    console.log(`   🎁 Бесплатных генераций ПОСЛЕ: ${referrerQuotaAfter}`);
    console.log(`   ${quotaDiff > 0 ? '✅' : '❌'} Изменение: +${quotaDiff}`);
    console.log(`   👥 Приглашено пользователей: ${referrerAfter?.referredUsers?.length || 0}`);
    
    // Проверяем нового пользователя ПОСЛЕ
    const newUserAfter = await userService.getUser(newUserId);
    const newUserQuotaBefore = newUser?.free_quota || 0;
    const newUserQuotaAfter = newUserAfter?.free_quota || 0;
    const newUserQuotaDiff = newUserQuotaAfter - newUserQuotaBefore;
    
    console.log(`\n👶 Новый пользователь (ID: ${newUserId}):`);
    console.log(`   🎁 Бесплатных генераций ДО: ${newUserQuotaBefore}`);
    console.log(`   🎁 Бесплатных генераций ПОСЛЕ: ${newUserQuotaAfter}`);
    console.log(`   ${newUserQuotaDiff > 0 ? '✅' : '❌'} Изменение: +${newUserQuotaDiff}`);
    
    console.log('\n📋 Шаг 5: Проверка реферальной статистики');
    console.log('-'.repeat(70));
    
    const refStats = await referralService.getReferralStats(referrerId);
    console.log(`📊 Статистика реферера:`);
    console.log(`   👥 Всего приглашено: ${refStats.referredUsers || 0}`);
    console.log(`   💼 Экспертных рефералов: ${refStats.expertReferrals || 0}`);
    console.log(`   💰 Заработано кэшбэка: ${(refStats.totalCashback || 0).toFixed(2)}₽`);
    
    console.log('\n📋 Шаг 6: Очистка');
    console.log('-'.repeat(70));
    
    console.log(`ℹ️  Тестовый пользователь ${newUserId} останется в системе`);
    console.log(`   (можно удалить вручную через админ-панель)`);
    
    // Возвращаем квоту реферера обратно
    if (quotaDiff > 0) {
        await userService.removeFreeQuota(referrerId, quotaDiff);
        console.log(`↩️  Квота реферера возвращена обратно (-${quotaDiff})`);
    }
    
    // Возвращаем квоту нового пользователя обратно
    if (newUserQuotaDiff > 0) {
        await userService.removeFreeQuota(newUserId, newUserQuotaDiff);
        console.log(`↩️  Квота нового пользователя возвращена обратно (-${newUserQuotaDiff})`);
    }
    
    // Удаляем связь из Redis
    await redis.del(`user_referrer:${newUserId}`);
    console.log(`🗑️  Связь в Redis удалена`);
    
    // Удаляем реферала из списка реферера
    const referrerCleanup = await userService.getUser(referrerId);
    const cleanedReferredUsers = (referrerCleanup.referredUsers || []).filter(
        id => id !== newUserId
    );
    await userService.updateUser(referrerId, { referredUsers: cleanedReferredUsers });
    console.log(`🗑️  Тестовый реферал удален из списка реферера`);
    
    console.log('\n' + '='.repeat(70));
    console.log('📊 ИТОГОВЫЙ РЕЗУЛЬТАТ:');
    console.log('='.repeat(70));
    
    if (success && quotaDiff > 0 && newUserQuotaDiff > 0) {
        console.log('✅ ВСЕ РАБОТАЕТ КОРРЕКТНО!');
        console.log(`   ✅ Реферер получил +${quotaDiff} генерацию`);
        console.log(`   ✅ Новый пользователь получил +${newUserQuotaDiff} генерацию`);
        console.log(`   ✅ Реферальная связь установлена`);
    } else {
        console.log('❌ ОБНАРУЖЕНЫ ПРОБЛЕМЫ:');
        if (!success) console.log('   ❌ Реферал не обработан');
        if (quotaDiff === 0) console.log('   ❌ Реферер не получил генерацию');
        if (newUserQuotaDiff === 0) console.log('   ❌ Новый пользователь не получил генерацию');
    }
    
    console.log('='.repeat(70) + '\n');
    
    process.exit(0);
}

testReferralFlow().catch(err => {
    console.error('❌ Test failed:', err);
    console.error(err.stack);
    process.exit(1);
});
