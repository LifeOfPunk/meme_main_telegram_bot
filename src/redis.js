import Redis from 'ioredis';
import 'dotenv/config';

const redis = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6379/0');

redis.on('connect', () => {
    console.log('✅ Connected to Redis successfully');
});

redis.on('error', (err) => {
    console.error('❌ Redis connection error:', err.message);
});

export let stagingRedis = null;
if (process.env.STAGING_REDIS_URL) {
    try {
        stagingRedis = new Redis(process.env.STAGING_REDIS_URL, {
            maxRetriesPerRequest: 1,
            enableOfflineQueue: false
        });
        stagingRedis.on('connect', () => {
            console.log('✅ Connected to Staging Redis successfully (dual-write active)');
        });
        stagingRedis.on('error', (err) => {
            console.warn('⚠️ Staging Redis connection warning (dual-write will be skipped):', err.message);
        });
    } catch (err) {
        console.warn('⚠️ Failed to initialize Staging Redis client:', err.message);
    }
}

export default redis;