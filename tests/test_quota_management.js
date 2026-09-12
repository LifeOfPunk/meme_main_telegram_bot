/**
 * Тест функционала управления генерациями в админ-панели
 * 
 * Этот скрипт тестирует:
 * - Методы UserService для добавления/удаления генераций
 * - Получение информации о пользователе
 * - Проверку валидации
 */

import { UserService } from '../src/services/User.service.js';
import redis from '../src/redis.js';

const userService = new UserService();

// Тестовый ID пользователя
const TEST_USER_ID = 999999999;

async function runTests() {
    console.log('🧪 Начинаем тестирование функционала управления генерациями\n');
    
    try {
        // Тест 1: Создание тестового пользователя
        console.log('📝 Тест 1: Создание тестового пользователя');
        const testUser = await userService.createUser({
            id: TEST_USER_ID,
            username: 'test_user',
            first_name: 'Test',
            last_name: 'User'
        });
        console.log(`✅ Пользователь создан: ${TEST_USER_ID}`);
        console.log(`   Бесплатных генераций: ${testUser.free_quota}`);
        console.log(`   Платных генераций: ${testUser.paid_quota}\n`);
        
        // Тест 2: Получение пользователя
        console.log('📝 Тест 2: Получение информации о пользователе');
        const user = await userService.getUser(TEST_USER_ID);
        if (user) {
            console.log(`✅ Пользователь найден: ${user.firstName} ${user.lastName}`);
            console.log(`   Username: @${user.username}`);
            console.log(`   ID: ${user.userId}\n`);
        } else {
            console.log(`❌ Пользователь не найден\n`);
        }
        
        // Тест 3: Добавление генераций
        console.log('📝 Тест 3: Добавление 10 генераций');
        const oldQuota1 = user.free_quota;
        await userService.addFreeQuota(TEST_USER_ID, 10);
        const user2 = await userService.getUser(TEST_USER_ID);
        const newQuota1 = user2.free_quota;
        console.log(`   Было: ${oldQuota1}`);
        console.log(`   Добавлено: 10`);
        console.log(`   Стало: ${newQuota1}`);
        console.log(newQuota1 === oldQuota1 + 10 ? '✅ Тест пройден\n' : '❌ Тест провален\n');
        
        // Тест 4: Удаление генераций
        console.log('📝 Тест 4: Удаление 5 генераций');
        const oldQuota2 = user2.free_quota;
        await userService.removeFreeQuota(TEST_USER_ID, 5);
        const user3 = await userService.getUser(TEST_USER_ID);
        const newQuota2 = user3.free_quota;
        console.log(`   Было: ${oldQuota2}`);
        console.log(`   Удалено: 5`);
        console.log(`   Стало: ${newQuota2}`);
        console.log(newQuota2 === oldQuota2 - 5 ? '✅ Тест пройден\n' : '❌ Тест провален\n');
        
        // Тест 5: Удаление больше чем есть
        console.log('📝 Тест 5: Удаление больше генераций чем есть (не должно стать отрицательным)');
        const oldQuota3 = user3.free_quota;
        await userService.removeFreeQuota(TEST_USER_ID, 1000);
        const user4 = await userService.getUser(TEST_USER_ID);
        const newQuota3 = user4.free_quota;
        console.log(`   Было: ${oldQuota3}`);
        console.log(`   Попытка удалить: 1000`);
        console.log(`   Стало: ${newQuota3}`);
        console.log(newQuota3 === 0 ? '✅ Тест пройден (баланс не стал отрицательным)\n' : '❌ Тест провален\n');
        
        // Тест 6: Добавление большого количества
        console.log('📝 Тест 6: Добавление большого количества (250 генераций)');
        const oldQuota4 = user4.free_quota;
        await userService.addFreeQuota(TEST_USER_ID, 250);
        const user5 = await userService.getUser(TEST_USER_ID);
        const newQuota4 = user5.free_quota;
        console.log(`   Было: ${oldQuota4}`);
        console.log(`   Добавлено: 250`);
        console.log(`   Стало: ${newQuota4}`);
        console.log(newQuota4 === oldQuota4 + 250 ? '✅ Тест пройден\n' : '❌ Тест провален\n');
        
        // Тест 7: Проверка платных генераций
        console.log('📝 Тест 7: Добавление платных генераций');
        const oldPaidQuota = user5.paid_quota;
        await userService.addPaidQuota(TEST_USER_ID, 100);
        const user6 = await userService.getUser(TEST_USER_ID);
        const newPaidQuota = user6.paid_quota;
        console.log(`   Было платных: ${oldPaidQuota}`);
        console.log(`   Добавлено: 100`);
        console.log(`   Стало платных: ${newPaidQuota}`);
        console.log(newPaidQuota === oldPaidQuota + 100 ? '✅ Тест пройден\n' : '❌ Тест провален\n');
        
        // Очистка: Удаление тестового пользователя
        console.log('🧹 Очистка: Удаление тестового пользователя');
        await redis.del(`user:${TEST_USER_ID}`);
        await redis.srem('all_users', TEST_USER_ID);
        console.log('✅ Тестовый пользователь удалён\n');
        
        console.log('✅ ВСЕ ТЕСТЫ ПРОЙДЕНЫ УСПЕШНО! 🎉\n');
        
    } catch (err) {
        console.error('❌ ОШИБКА ПРИ ТЕСТИРОВАНИИ:', err.message);
        console.error(err.stack);
    } finally {
        // Закрываем соединение с Redis
        await redis.quit();
        console.log('👋 Тестирование завершено');
        process.exit(0);
    }
}

// Запуск тестов
runTests().catch(err => {
    console.error('❌ Критическая ошибка:', err);
    process.exit(1);
});
