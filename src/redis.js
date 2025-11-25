import Redis from 'ioredis';
import 'dotenv/config';

const redis = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6379/0');

redis.on('connect', () => {
    console.log('✅ Connected to Redis successfully');
});

redis.on('error', (err) => {
    console.error('❌ Redis connection error:', err);
});

export default redis;