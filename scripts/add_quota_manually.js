import 'dotenv/config';
import { UserService } from './src/services/User.service.js';
import redis from './src/redis.js';

const userService = new UserService();

async function addQuotaManually() {
    const userId = parseInt(process.argv[2]);
    const amount = parseInt(process.argv[3]);

    if (!userId || !amount) {
        console.log('❌ Usage: node add_quota_manually.js <userId> <amount>');
        console.log('   Example: node add_quota_manually.js 1916527652 50');
        process.exit(1);
    }

    try {
        // Проверяем существует ли пользователь
        let user = await userService.getUser(userId);
        
        if (!user) {
            console.log(`⚠️  User ${userId} not found. Creating new user...`);
            // Создаём пользователя с минимальными данными
            user = {
                userId,
                username: null,
                firstName: null,
                lastName: null,
                free_quota: 0,
                paid_quota: 0,
                used_free_quota: 0,
                used_paid_quota: 0,
                total_generations: 0,
                successful_generations: 0,
                failed_generations: 0,
                total_spent: 0,
                remaining_balance: 0,
                referralSource: null,
                referredUsers: [],
                expertReferrals: [],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            
            await redis.set(`user:${userId}`, JSON.stringify(user));
            await redis.sadd('all_users', userId);
            console.log(`✅ User ${userId} created`);
        }

        // Добавляем платные генерации
        const oldQuota = user.paid_quota || 0;
        await userService.addPaidQuota(userId, amount);
        
        // Получаем обновлённые данные
        user = await userService.getUser(userId);
        const newQuota = user.paid_quota;

        console.log('\n✅ Successfully added quota!');
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        console.log(`👤 User ID: ${userId}`);
        console.log(`📊 Old paid quota: ${oldQuota}`);
        console.log(`➕ Added: ${amount}`);
        console.log(`📊 New paid quota: ${newQuota}`);
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

        process.exit(0);
    } catch (err) {
        console.error('❌ Error:', err.message);
        process.exit(1);
    }
}

addQuotaManually();
