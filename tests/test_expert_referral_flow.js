import dotenv from 'dotenv';
dotenv.config();

import { ReferralService } from '../src/services/Referral.service.js';
import { UserService } from '../src/services/User.service.js';
import { PaymentCryptoService } from '../src/services/PaymentCrypto.service.js';
import redis from '../src/redis.js';

const referralService = new ReferralService();
const userService = new UserService();
const paymentCryptoService = new PaymentCryptoService();

async function testExpertReferralFlow() {
    console.log('🧪 ТЕСТ ЭКСПЕРТНОЙ РЕФЕРАЛЬНОЙ СИСТЕМЫ\n');
    console.log('='.repeat(80));
    
    // Генерируем уникальные ID для теста
    const expertId = 1323534384; // Реальный эксперт
    const newUserId = Math.floor(Math.random() * 1000000000); // Новый пользователь
    
    console.log('\n📋 Шаг 1: Проверка начального состояния');
    console.log('-'.repeat(80));
    
    // Проверяем эксперта ДО
    const expertBefore = await userService.getUser(expertId);
    console.log(`👤 Эксперт (ID: ${expertId}):`);
    console.log(`   Имя: ${expertBefore?.firstName || 'нет'}`);
    console.log(`   💰 Кэшбэк ДО: ${(expertBefore?.totalCashback || 0).toFixed(2)}₽`);
    console.log(`   💼 Экспертных рефералов ДО: ${expertBefore?.expertReferrals?.length || 0}`);
    
    // Проверяем, что новый пользователь не существует
    let newUser = await userService.getUser(newUserId);
    if (newUser) {
        console.log(`\n⚠️  Тестовый пользователь ${newUserId} уже существует, используем другой ID...`);
        return testExpertReferralFlow(); // Перезапускаем с новым ID
    }
    
    console.log('\n📋 Шаг 2: Создание нового пользователя через экспертную ссылку');
    console.log('-'.repeat(80));
    
    // Создаем нового пользователя (симулируем /start с экспертной ссылкой)
    await userService.createUser({
        id: newUserId,
        first_name: 'Тестовый',
        last_name: 'Клиент',
        username: 'test_expert_client'
    }, `expert_${expertId}`);
    
    newUser = await userService.getUser(newUserId);
    console.log(`✅ Новый пользователь создан (ID: ${newUserId})`);
    console.log(`   Имя: ${newUser?.firstName || 'нет'}`);
    console.log(`   🎁 Бесплатных генераций: ${newUser?.free_quota || 0}`);
    
    console.log('\n📋 Шаг 3: Обработка экспертной реферальной ссылки');
    console.log('-'.repeat(80));
    console.log(`🔗 Симулируем переход по ссылке: ?start=expert_${expertId}`);
    
    // Обрабатываем экспертный реферал
    const success = await referralService.processExpertReferral(expertId, newUserId);
    
    if (success) {
        console.log('✅ Экспертный реферал успешно обработан!');
    } else {
        console.log('❌ Ошибка обработки экспертного реферала');
    }
    
    console.log('\n📋 Шаг 4: Проверка связи эксперт-клиент');
    console.log('-'.repeat(80));
    
    // Проверяем связь в Redis
    const expertLink = await redis.get(`expert_referral:${newUserId}`);
    console.log(`🔗 Связь в Redis: ${expertLink ? `✅ ${expertLink}` : '❌ Не найдена'}`);
    
    // Проверяем эксперта ПОСЛЕ
    const expertAfter = await userService.getUser(expertId);
    console.log(`\n👤 Эксперт (ID: ${expertId}):`);
    console.log(`   💼 Экспертных рефералов ПОСЛЕ: ${expertAfter?.expertReferrals?.length || 0}`);
    console.log(`   ${expertAfter?.expertReferrals?.includes(newUserId) ? '✅' : '❌'} Новый клиент в списке`);
    
    console.log('\n📋 Шаг 5: Симуляция оплаты клиентом');
    console.log('-'.repeat(80));
    
    const paymentAmount = 500; // 500 рублей
    console.log(`💳 Клиент оплачивает: ${paymentAmount}₽`);
    
    // Обрабатываем кэшбэк
    const cashbackResults = await referralService.processExpertCashback(newUserId, paymentAmount);
    
    if (cashbackResults && cashbackResults.length > 0) {
        console.log(`✅ Кэшбэк начислен:`);
        cashbackResults.forEach(cb => {
            console.log(`   💰 Уровень ${cb.level}: ${cb.amount.toFixed(2)}₽ (${cb.percent}%) → Эксперт ${cb.expertId}`);
        });
    } else {
        console.log('❌ Кэшбэк не начислен');
    }
    
    console.log('\n📋 Шаг 6: Проверка баланса эксперта');
    console.log('-'.repeat(80));
    
    const expertFinal = await userService.getUser(expertId);
    const cashbackBefore = expertBefore?.totalCashback || 0;
    const cashbackAfter = expertFinal?.totalCashback || 0;
    const cashbackDiff = cashbackAfter - cashbackBefore;
    
    console.log(`👤 Эксперт (ID: ${expertId}):`);
    console.log(`   💰 Кэшбэк ДО: ${cashbackBefore.toFixed(2)}₽`);
    console.log(`   💰 Кэшбэк ПОСЛЕ: ${cashbackAfter.toFixed(2)}₽`);
    console.log(`   ${cashbackDiff > 0 ? '✅' : '❌'} Изменение: +${cashbackDiff.toFixed(2)}₽`);
    
    const expectedCashback = (paymentAmount * 25) / 100; // 25% от 500₽ = 125₽
    console.log(`   📊 Ожидалось: +${expectedCashback.toFixed(2)}₽`);
    console.log(`   ${Math.abs(cashbackDiff - expectedCashback) < 0.01 ? '✅' : '❌'} Сумма корректна`);
    
    console.log('\n📋 Шаг 7: Проверка защиты от абуза (повторное использование ссылки)');
    console.log('-'.repeat(80));
    
    // Пытаемся повторно обработать реферал
    const abuseAttempt1 = await referralService.processExpertReferral(expertId, newUserId);
    console.log(`🔒 Повторная обработка того же реферала: ${abuseAttempt1 ? '❌ РАЗРЕШЕНО (БАГ!)' : '✅ ЗАБЛОКИРОВАНО'}`);
    
    // Пытаемся использовать обычную реферальную ссылку после экспертной
    const abuseAttempt2 = await referralService.processReferral(expertId, newUserId);
    console.log(`🔒 Обычная реф-ссылка после экспертной: ${abuseAttempt2 ? '❌ РАЗРЕШЕНО (БАГ!)' : '✅ ЗАБЛОКИРОВАНО'}`);
    
    // Создаем второго пользователя и пытаемся использовать ту же экспертную ссылку
    const newUserId2 = Math.floor(Math.random() * 1000000000);
    await userService.createUser({
        id: newUserId2,
        first_name: 'Второй',
        last_name: 'Клиент',
        username: 'test_expert_client2'
    });
    
    const validAttempt = await referralService.processExpertReferral(expertId, newUserId2);
    console.log(`🔓 Новый пользователь с той же ссылкой: ${validAttempt ? '✅ РАЗРЕШЕНО' : '❌ ЗАБЛОКИРОВАНО (БАГ!)'}`);
    
    // Создаем третьего пользователя и пытаемся использовать сначала обычную, потом экспертную ссылку
    const newUserId3 = Math.floor(Math.random() * 1000000000);
    await userService.createUser({
        id: newUserId3,
        first_name: 'Третий',
        last_name: 'Клиент',
        username: 'test_expert_client3'
    });
    
    // Сначала обычная реферальная ссылка
    await referralService.processReferral(expertId, newUserId3);
    // Потом пытаемся экспертную
    const abuseAttempt3 = await referralService.processExpertReferral(expertId, newUserId3);
    console.log(`🔒 Экспертная ссылка после обычной: ${abuseAttempt3 ? '❌ РАЗРЕШЕНО (БАГ!)' : '✅ ЗАБЛОКИРОВАНО'}`);
    
    console.log('\n📋 Шаг 8: Проверка самореферала');
    console.log('-'.repeat(80));
    
    const selfReferral = await referralService.processExpertReferral(expertId, expertId);
    console.log(`🔒 Самореферал (эксперт приглашает себя): ${selfReferral ? '❌ РАЗРЕШЕНО (БАГ!)' : '✅ ЗАБЛОКИРОВАНО'}`);
    
    console.log('\n📋 Шаг 9: Проверка статистики');
    console.log('-'.repeat(80));
    
    const refStats = await referralService.getReferralStats(expertId);
    console.log(`📊 Статистика эксперта:`);
    console.log(`   👥 Обычных рефералов: ${refStats.referredUsers || 0}`);
    console.log(`   💼 Экспертных рефералов: ${refStats.expertReferrals || 0}`);
    console.log(`   💰 Заработано кэшбэка: ${(refStats.totalCashback || 0).toFixed(2)}₽`);
    
    console.log('\n📋 Шаг 10: Очистка тестовых данных');
    console.log('-'.repeat(80));
    
    // Возвращаем кэшбэк обратно
    if (cashbackDiff > 0) {
        const expertCurrent = await userService.getUser(expertId);
        await userService.updateUser(expertId, { 
            totalCashback: (expertCurrent.totalCashback || 0) - cashbackDiff 
        });
        console.log(`↩️  Кэшбэк эксперта возвращен обратно (-${cashbackDiff.toFixed(2)}₽)`);
    }
    
    // Удаляем связи из Redis
    await redis.del(`expert_referral:${newUserId}`);
    await redis.del(`expert_referral:${newUserId2}`);
    await redis.del(`user_referrer:${newUserId3}`);
    console.log(`🗑️  Связи в Redis удалены`);
    
    // Удаляем рефералов из списка эксперта
    const expertCleanup = await userService.getUser(expertId);
    const cleanedExpertReferrals = (expertCleanup.expertReferrals || []).filter(
        id => id !== newUserId && id !== newUserId2
    );
    const cleanedReferredUsers = (expertCleanup.referredUsers || []).filter(
        id => id !== newUserId3
    );
    await userService.updateUser(expertId, { 
        expertReferrals: cleanedExpertReferrals,
        referredUsers: cleanedReferredUsers
    });
    console.log(`🗑️  Тестовые рефералы удалены из списка эксперта`);
    
    // Возвращаем бонус за обычный реферал
    await userService.removeFreeQuota(expertId, 1);
    console.log(`↩️  Бонус за обычный реферал возвращен (-1 генерация)`);
    
    console.log(`ℹ️  Тестовые пользователи ${newUserId}, ${newUserId2}, ${newUserId3} останутся в системе`);
    console.log(`   (можно удалить вручную через админ-панель)`);
    
    console.log('\n' + '='.repeat(80));
    console.log('📊 ИТОГОВЫЙ РЕЗУЛЬТАТ:');
    console.log('='.repeat(80));
    
    const allChecks = [
        { name: 'Экспертный реферал обработан', passed: success },
        { name: 'Связь в Redis установлена', passed: !!expertLink },
        { name: 'Клиент добавлен в список эксперта', passed: expertAfter?.expertReferrals?.includes(newUserId) },
        { name: 'Кэшбэк начислен', passed: cashbackResults && cashbackResults.length > 0 },
        { name: 'Сумма кэшбэка корректна', passed: Math.abs(cashbackDiff - expectedCashback) < 0.01 },
        { name: 'Защита от повторного использования', passed: !abuseAttempt1 },
        { name: 'Защита: обычная реф после экспертной', passed: !abuseAttempt2 },
        { name: 'Защита: экспертная реф после обычной', passed: !abuseAttempt3 },
        { name: 'Новый пользователь может использовать ссылку', passed: validAttempt },
        { name: 'Защита от самореферала', passed: !selfReferral }
    ];
    
    const passedChecks = allChecks.filter(c => c.passed).length;
    const totalChecks = allChecks.length;
    
    console.log(`\n📈 Пройдено проверок: ${passedChecks}/${totalChecks}\n`);
    
    allChecks.forEach(check => {
        console.log(`   ${check.passed ? '✅' : '❌'} ${check.name}`);
    });
    
    if (passedChecks === totalChecks) {
        console.log('\n🎉 ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ! СИСТЕМА РАБОТАЕТ КОРРЕКТНО!');
    } else {
        console.log('\n⚠️  ОБНАРУЖЕНЫ ПРОБЛЕМЫ! ТРЕБУЕТСЯ ИСПРАВЛЕНИЕ!');
    }
    
    console.log('='.repeat(80) + '\n');
    
    process.exit(0);
}

testExpertReferralFlow().catch(err => {
    console.error('❌ Test failed:', err);
    console.error(err.stack);
    process.exit(1);
});
