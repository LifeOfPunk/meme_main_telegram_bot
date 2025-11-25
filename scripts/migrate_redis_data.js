import redis from './src/redis.js';

async function migrate() {
    console.log('🔄 Starting Redis data migration...\n');
    
    try {
        // Мигрируем пользователей
        const userKeys = await redis.keys('user:*');
        console.log(`Found ${userKeys.length} users`);
        
        for (const key of userKeys) {
            const type = await redis.type(key);
            
            if (type === 'string') {
                // Данные в JSON формате, уже правильный формат
                const data = await redis.get(key);
                console.log(`✅ User ${key} - already in correct format`);
            } else if (type === 'hash') {
                // Конвертируем из hash в JSON string
                const data = await redis.hGetAll(key);
                await redis.del(key);
                await redis.set(key, JSON.stringify(data));
                console.log(`✅ Migrated user ${key} from hash to JSON`);
            }
        }
        
        // Мигрируем заказы
        const orderKeys = await redis.keys('order:*');
        console.log(`\nFound ${orderKeys.length} orders`);
        
        for (const key of orderKeys) {
            const type = await redis.type(key);
            
            if (type === 'string') {
                console.log(`✅ Order ${key} - already in correct format`);
            } else if (type === 'hash') {
                const data = await redis.hGetAll(key);
                await redis.del(key);
                await redis.set(key, JSON.stringify(data));
                console.log(`✅ Migrated order ${key} from hash to JSON`);
            }
        }
        
        console.log('\n✅ Migration completed!');
        process.exit(0);
        
    } catch (err) {
        console.error('❌ Migration error:', err);
        process.exit(1);
    }
}

migrate();
