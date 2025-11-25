import 'dotenv/config';
import redis from './src/redis.js';

async function testRedis() {
    try {
        console.log('🔍 Тестирование подключения к Redis...\n');
        
        // Проверка подключения
        await redis.ping();
        console.log('✅ Redis подключен успешно!\n');
        
        // Проверка пользователей
        console.log('👥 Проверка пользователей:');
        const totalUsers = await redis.scard('all_users');
        console.log(`   Всего пользователей: ${totalUsers}`);
        
        if (totalUsers > 0) {
            const userIds = await redis.smembers('all_users');
            console.log(`   ID пользователей: ${userIds.slice(0, 5).join(', ')}${userIds.length > 5 ? '...' : ''}`);
            
            // Проверяем первого пользователя
            if (userIds.length > 0) {
                const firstUserId = userIds[0];
                const userData = await redis.get(`user:${firstUserId}`);
                if (userData) {
                    const user = JSON.parse(userData);
                    console.log(`\n   Пример пользователя (${firstUserId}):`);
                    console.log(`   - Username: @${user.username || 'нет'}`);
                    console.log(`   - Имя: ${user.firstName || 'нет'}`);
                    console.log(`   - Бесплатных генераций: ${user.free_quota}`);
                    console.log(`   - Платных генераций: ${user.paid_quota}`);
                } else {
                    console.log(`   ⚠️ Данные пользователя ${firstUserId} не найдены`);
                }
            }
        } else {
            console.log('   ⚠️ Нет пользователей в базе!');
        }
        
        // Проверка генераций
        console.log('\n🎬 Проверка генераций:');
        const genKeys = await redis.keys('generation:*');
        console.log(`   Всего генераций: ${genKeys.length}`);
        
        if (genKeys.length > 0) {
            console.log(`   Ключи: ${genKeys.slice(0, 3).join(', ')}${genKeys.length > 3 ? '...' : ''}`);
        }
        
        // Проверка заказов
        console.log('\n💳 Проверка заказов:');
        const orderKeys = await redis.keys('order:*');
        console.log(`   Всего заказов: ${orderKeys.length}`);
        
        console.log('\n✅ Тест завершен успешно!');
        
    } catch (err) {
        console.error('❌ Ошибка:', err.message);
        console.error('Stack:', err.stack);
    } finally {
        await redis.quit();
        process.exit(0);
    }
}

testRedis();
