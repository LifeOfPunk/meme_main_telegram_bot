import 'dotenv/config';
import redis from './src/redis.js';
import { UserService } from './src/services/User.service.js';
import { OrderService } from './src/services/Order.service.js';
import { GenerationService } from './src/services/Generation.service.js';
import { ReferralService } from './src/services/Referral.service.js';
import { PaymentCryptoService } from './src/services/PaymentCrypto.service.js';
import { PaymentFiatService } from './src/services/PaymentFiat.service.js';
import { SubscriptionService } from './src/services/Subscription.service.js';
import { errorLogger } from './src/services/ErrorLogger.service.js';
import axios from 'axios';

console.log('🧪 ЗАПУСК ПОЛНОГО ТЕСТИРОВАНИЯ БОТА\n');

const TEST_USER_ID = 999999999;
const TEST_USER_ID_2 = 999999998;

let passedTests = 0;
let failedTests = 0;

// Утилита для тестов
function test(name, fn) {
    return async () => {
        try {
            process.stdout.write(`🔍 ${name}... `);
            await fn();
            console.log('✅ PASS');
            passedTests++;
        } catch (err) {
            console.log(`❌ FAIL: ${err.message}`);
            failedTests++;
        }
    };
}

function assert(condition, message) {
    if (!condition) {
        throw new Error(message || 'Assertion failed');
    }
}

// Очистка тестовых данных
async function cleanup() {
    console.log('\n🧹 Очистка тестовых данных...');
    try {
        await redis.del(`user:${TEST_USER_ID}`);
        await redis.del(`user:${TEST_USER_ID_2}`);
        await redis.del(`user:${TEST_USER_ID + 1}`);
        await redis.srem('all_users', TEST_USER_ID);
        await redis.srem('all_users', TEST_USER_ID_2);
        await redis.srem('all_users', TEST_USER_ID + 1);
        
        // Удаляем реферальные данные
        await redis.del(`user_referrer:${TEST_USER_ID}`);
        await redis.del(`user_referrer:${TEST_USER_ID_2}`);
        await redis.del(`expert_referral:${TEST_USER_ID}`);
        await redis.del(`expert_referral:${TEST_USER_ID_2}`);
        
        // Удаляем тестовые генерации
        const allGens = await redis.keys('generation:*');
        for (const key of allGens) {
            const gen = await redis.get(key);
            if (gen) {
                const genData = JSON.parse(gen);
                if (genData.userId === TEST_USER_ID || genData.userId === TEST_USER_ID_2) {
                    await redis.del(key);
                }
            }
        }
        
        // Удаляем тестовые заказы
        const allOrders = await redis.keys('order:*');
        for (const key of allOrders) {
            const order = await redis.get(key);
            if (order) {
                const orderData = JSON.parse(order);
                if (orderData.userId === TEST_USER_ID || orderData.userId === TEST_USER_ID_2) {
                    await redis.del(key);
                }
            }
        }
        
        console.log('✅ Тестовые данные очищены\n');
    } catch (err) {
        console.log('⚠️ Ошибка при очистке:', err.message);
    }
}

// ==================== ТЕСТЫ ====================

// 1. Проверка подключения к Redis
const testRedisConnection = test('Подключение к Redis', async () => {
    const result = await redis.ping();
    assert(result === 'PONG', 'Redis не отвечает');
});

// 2. Проверка переменных окружения
const testEnvVariables = test('Переменные окружения', async () => {
    assert(process.env.BOT_TOKEN, 'BOT_TOKEN не установлен');
    assert(process.env.BOT_TOKEN_ADMIN, 'BOT_TOKEN_ADMIN не установлен');
    assert(process.env.KIE_AI_API_KEY || process.env.RUNWARE_API_KEY, 'API ключ для генерации не установлен');
    assert(process.env.REDIS_URL, 'REDIS_URL не установлен');
});

// 3. Создание пользователя
const testCreateUser = test('Создание пользователя', async () => {
    const userService = new UserService();
    const testUser = {
        id: TEST_USER_ID,
        username: 'testuser',
        first_name: 'Test',
        last_name: 'User'
    };
    
    const user = await userService.createUser(testUser);
    assert(user.userId === TEST_USER_ID, 'User ID не совпадает');
    assert(user.username === 'testuser', 'Username не совпадает');
    assert(user.free_quota > 0, 'Бесплатные генерации не начислены');
});

// 4. Получение пользователя
const testGetUser = test('Получение пользователя', async () => {
    const userService = new UserService();
    const user = await userService.getUser(TEST_USER_ID);
    assert(user !== null, 'Пользователь не найден');
    assert(user.userId === TEST_USER_ID, 'User ID не совпадает');
});

// 5. Обновление пользователя
const testUpdateUser = test('Обновление пользователя', async () => {
    const userService = new UserService();
    await userService.updateUser(TEST_USER_ID, { username: 'updated_user' });
    const user = await userService.getUser(TEST_USER_ID);
    assert(user.username === 'updated_user', 'Username не обновился');
});

// 6. Проверка квоты
const testHasQuota = test('Проверка наличия квоты', async () => {
    const userService = new UserService();
    const hasQuota = await userService.hasQuota(TEST_USER_ID);
    assert(hasQuota === true, 'Квота должна быть доступна');
});

// 7. Списание квоты
const testDeductQuota = test('Списание квоты', async () => {
    const userService = new UserService();
    const user = await userService.getUser(TEST_USER_ID);
    const initialQuota = user.free_quota;
    
    const deducted = await userService.deductQuota(TEST_USER_ID);
    assert(deducted === true, 'Квота не списалась');
    
    const updatedUser = await userService.getUser(TEST_USER_ID);
    assert(updatedUser.free_quota === initialQuota - 1, 'Квота списалась неправильно');
});

// 8. Добавление квоты
const testAddQuota = test('Добавление квоты', async () => {
    const userService = new UserService();
    const user = await userService.getUser(TEST_USER_ID);
    const initialQuota = user.free_quota;
    
    await userService.addFreeQuota(TEST_USER_ID, 5);
    const updatedUser = await userService.getUser(TEST_USER_ID);
    assert(updatedUser.free_quota === initialQuota + 5, 'Квота не добавилась');
});

// 9. Возврат квоты
const testRefundQuota = test('Возврат квоты', async () => {
    const userService = new UserService();
    const user = await userService.getUser(TEST_USER_ID);
    const initialQuota = user.free_quota;
    
    await userService.refundQuota(TEST_USER_ID);
    const updatedUser = await userService.getUser(TEST_USER_ID);
    assert(updatedUser.free_quota === initialQuota + 1, 'Квота не вернулась');
});

// 10. Получение всех пользователей
const testGetAllUsers = test('Получение всех пользователей', async () => {
    const userService = new UserService();
    const users = await userService.getAllUsers();
    assert(Array.isArray(users), 'Результат должен быть массивом');
    assert(users.length > 0, 'Должен быть хотя бы один пользователь');
});

// 11. Подсчет пользователей
const testGetTotalUsers = test('Подсчет пользователей', async () => {
    const userService = new UserService();
    const total = await userService.getTotalUsers();
    assert(typeof total === 'number', 'Результат должен быть числом');
    assert(total > 0, 'Должен быть хотя бы один пользователь');
});

// 12. Создание генерации
const testCreateGeneration = test('Создание генерации', async () => {
    const generationService = new GenerationService();
    const generation = await generationService.createGeneration({
        userId: TEST_USER_ID,
        chatId: TEST_USER_ID,
        memeId: 'mama_taxi',
        name: 'TestName',
        gender: 'male'
    });
    
    assert(generation, 'Генерация не создана');
    assert(generation.userId === TEST_USER_ID, 'User ID не совпадает');
});

// 13. Получение генерации
const testGetGeneration = test('Получение генерации', async () => {
    const generationService = new GenerationService();
    const allGens = await redis.keys('generation:*');
    
    if (allGens.length > 0) {
        const genId = allGens[0].split(':')[1];
        const generation = await generationService.getGeneration(genId);
        assert(generation !== null, 'Генерация не найдена');
    }
});

// 14. Статистика генераций
const testGenerationStats = test('Статистика генераций', async () => {
    const generationService = new GenerationService();
    const stats = await generationService.getGenerationStats();
    
    assert(typeof stats.total === 'number', 'total должен быть числом');
    assert(typeof stats.queued === 'number', 'queued должен быть числом');
    assert(typeof stats.processing === 'number', 'processing должен быть числом');
    assert(typeof stats.done === 'number', 'done должен быть числом');
    assert(typeof stats.failed === 'number', 'failed должен быть числом');
});

// 15. Создание заказа (крипто)
const testCreateCryptoOrder = test('Создание крипто-заказа', async () => {
    const orderService = new OrderService();
    const order = await orderService.createOrder({
        userId: TEST_USER_ID,
        packageKey: 'package_1',
        amount: 100,
        currency: 'RUB',
        crypto: 'USDT',
        chain: 'TRX',
        isFiat: false
    });
    
    assert(order, 'Заказ не создан');
    assert(order.userId === TEST_USER_ID, 'User ID не совпадает');
});

// 16. Получение заказа
const testGetOrder = test('Получение заказа', async () => {
    const allOrders = await redis.keys('order:*');
    
    if (allOrders.length > 0) {
        const orderId = allOrders[0].split(':')[1];
        const orderData = await redis.get(`order:${orderId}`);
        assert(orderData !== null, 'Заказ не найден');
        const order = JSON.parse(orderData);
        assert(order.userId, 'User ID не найден в заказе');
    }
});

// 17. Статистика платежей
const testPaymentStats = test('Статистика платежей', async () => {
    const orderService = new OrderService();
    const stats = await orderService.getPaymentStats();
    
    assert(typeof stats.total === 'number', 'total должен быть числом');
    assert(typeof stats.paid === 'number', 'paid должен быть числом');
    assert(typeof stats.unpaid === 'number', 'unpaid должен быть числом');
    assert(typeof stats.fiatRevenue === 'number', 'fiatRevenue должен быть числом');
});

// 18. Реферальная система - создание реферала
const testCreateReferral = test('Создание реферала', async () => {
    const userService = new UserService();
    const referralService = new ReferralService();
    
    // Очищаем старые данные реферала
    await redis.del(`user_referrer:${TEST_USER_ID_2}`);
    await redis.del(`expert_referral:${TEST_USER_ID_2}`);
    
    // Создаем второго пользователя заново
    await redis.del(`user:${TEST_USER_ID_2}`);
    await redis.srem('all_users', TEST_USER_ID_2);
    
    const testUser2 = {
        id: TEST_USER_ID_2,
        username: 'testuser2',
        first_name: 'Test2',
        last_name: 'User2'
    };
    await userService.createUser(testUser2);
    
    // Обрабатываем реферал
    const success = await referralService.processReferral(TEST_USER_ID, TEST_USER_ID_2);
    assert(success === true, 'Реферал не обработался');
    
    // Проверяем, что реферал добавлен
    const referrer = await userService.getUser(TEST_USER_ID);
    assert(referrer.referredUsers.includes(TEST_USER_ID_2), 'Реферал не добавлен в список');
});

// 19. Получение реферальной статистики
const testReferralStats = test('Реферальная статистика', async () => {
    const userService = new UserService();
    const user = await userService.getUser(TEST_USER_ID);
    
    assert(Array.isArray(user.referredUsers), 'referredUsers должен быть массивом');
    assert(user.referredUsers.length >= 1, 'Должен быть хотя бы один реферал');
});

// 20. Логирование ошибок
const testErrorLogging = test('Логирование ошибок', async () => {
    const errorData = await errorLogger.logError({
        message: 'Test error',
        stack: 'Test stack trace',
        name: 'TestError',
        source: 'Test Suite'
    });
    
    assert(errorData.id, 'Error ID не создан');
    assert(errorData.message === 'Test error', 'Сообщение ошибки не совпадает');
});

// 21. Получение статистики ошибок
const testErrorStats = test('Статистика ошибок', async () => {
    const stats = await errorLogger.getErrorStats();
    
    assert(typeof stats.total === 'number', 'total должен быть числом');
    assert(typeof stats.today === 'number', 'today должен быть числом');
    assert(typeof stats.week === 'number', 'week должен быть числом');
});

// 22. Проверка UTM источников
const testUTMSources = test('UTM источники', async () => {
    const userService = new UserService();
    
    // Создаем пользователя с UTM источником
    const testUserUTM = {
        id: TEST_USER_ID + 1,
        username: 'testuser_utm',
        first_name: 'UTM',
        last_name: 'Test'
    };
    
    await userService.createUser(testUserUTM, null, 'tiktok');
    const user = await userService.getUser(TEST_USER_ID + 1);
    
    assert(user.source === 'tiktok', 'UTM источник не сохранился');
    
    // Очистка
    await redis.del(`user:${TEST_USER_ID + 1}`);
    await redis.srem('all_users', TEST_USER_ID + 1);
});

// 23. Проверка API Kie.ai (если доступен)
const testKieAiAPI = test('Kie.ai API доступность', async () => {
    try {
        const apiKey = process.env.KIE_AI_API_KEY || process.env.RUNWARE_API_KEY;
        if (!apiKey) {
            throw new Error('API ключ не найден');
        }
        
        const response = await axios.post(
            'https://api.kie.ai/v1/video/generate',
            {
                prompt: 'test',
                duration: 5
            },
            {
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                timeout: 5000,
                validateStatus: () => true // Принимаем любой статус
            }
        );
        // API должен ответить (даже если с ошибкой)
        assert(response.status >= 200 && response.status < 500, 'API не отвечает');
    } catch (err) {
        if (err.code === 'ECONNABORTED') {
            throw new Error('Timeout при подключении к API');
        }
        if (err.code === 'ENOTFOUND') {
            throw new Error('API недоступен');
        }
        throw err;
    }
});

// 24. Проверка структуры конфига
const testConfigStructure = test('Структура конфига', async () => {
    const config = await import('./src/config.js');
    
    assert(config.MESSAGES, 'MESSAGES не определен');
    assert(config.PACKAGES, 'PACKAGES не определен');
    assert(config.SUPPORTED_CRYPTO, 'SUPPORTED_CRYPTO не определен');
    assert(config.ADMINS, 'ADMINS не определен');
    assert(Array.isArray(config.ADMINS), 'ADMINS должен быть массивом');
});

// 25. Проверка загрузки мемов
const testMemeLoader = test('Загрузка мемов', async () => {
    const { getMemeById } = await import('./src/utils/memeLoader.js');
    
    const meme = getMemeById('mama_taxi');
    assert(meme !== null, 'Мем mama_taxi не найден');
    assert(meme.id === 'mama_taxi', 'ID мема не совпадает');
    assert(meme.name, 'Название мема не найдено');
});

// ==================== ЗАПУСК ТЕСТОВ ====================

async function runAllTests() {
    console.log('📋 Список тестов:\n');
    
    const tests = [
        testRedisConnection,
        testEnvVariables,
        testCreateUser,
        testGetUser,
        testUpdateUser,
        testHasQuota,
        testDeductQuota,
        testAddQuota,
        testRefundQuota,
        testGetAllUsers,
        testGetTotalUsers,
        testCreateGeneration,
        testGetGeneration,
        testGenerationStats,
        testCreateCryptoOrder,
        testGetOrder,
        testPaymentStats,
        testCreateReferral,
        testReferralStats,
        testErrorLogging,
        testErrorStats,
        testUTMSources,
        testKieAiAPI,
        testConfigStructure,
        testMemeLoader
    ];
    
    console.log(`Всего тестов: ${tests.length}\n`);
    console.log('=' .repeat(60));
    console.log('НАЧАЛО ТЕСТИРОВАНИЯ');
    console.log('=' .repeat(60) + '\n');
    
    for (const testFn of tests) {
        await testFn();
    }
    
    console.log('\n' + '=' .repeat(60));
    console.log('РЕЗУЛЬТАТЫ');
    console.log('=' .repeat(60));
    console.log(`✅ Пройдено: ${passedTests}`);
    console.log(`❌ Провалено: ${failedTests}`);
    console.log(`📊 Успешность: ${((passedTests / (passedTests + failedTests)) * 100).toFixed(1)}%`);
    console.log('=' .repeat(60) + '\n');
    
    await cleanup();
    
    // Закрываем соединение с Redis
    await redis.quit();
    
    // Выход с кодом ошибки если есть проваленные тесты
    process.exit(failedTests > 0 ? 1 : 0);
}

// Запуск
runAllTests().catch(err => {
    console.error('\n❌ КРИТИЧЕСКАЯ ОШИБКА:', err);
    process.exit(1);
});
