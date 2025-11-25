import redis from './src/redis.js';

async function migrateKey(key) {
    const type = await redis.type(key);
    
    if (type === 'string') {
        return 'already JSON';
    } else if (type === 'hash') {
        const data = await redis.hGetAll(key);
        await redis.del(key);
        await redis.set(key, JSON.stringify(data));
        return 'migrated from hash';
    } else if (type === 'list' || type === 'set') {
        return 'list/set - OK';
    }
    return type;
}

async function migrate() {
    console.log('🔄 Migrating ALL Redis data...\n');
    
    const patterns = [
        'user:*',
        'order:*',
        'generation:*',
        'user_orders:*',
        'user_generations:*',
        'ref_activities:*',
        'email_to_order:*',
        'user_email:*'
    ];
    
    for (const pattern of patterns) {
        const keys = await redis.keys(pattern);
        console.log(`\n📦 ${pattern}: ${keys.length} keys`);
        
        for (const key of keys) {
            const result = await migrateKey(key);
            if (result === 'migrated from hash') {
                console.log(`  ✅ ${key}`);
            }
        }
    }
    
    console.log('\n✅ Migration completed!');
    process.exit(0);
}

migrate().catch(err => {
    console.error('❌ Error:', err);
    process.exit(1);
});
