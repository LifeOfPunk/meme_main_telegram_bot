import 'dotenv/config';
import redis from './src/redis.js';

async function checkRecentGenerations() {
    console.log('🔍 Checking recent generations...\n');
    
    try {
        const keys = await redis.keys('generation:*');
        console.log(`📊 Total generations: ${keys.length}\n`);
        
        const allGenerations = [];
        
        for (const key of keys) {
            const data = await redis.get(key);
            if (data) {
                const gen = JSON.parse(data);
                allGenerations.push(gen);
            }
        }
        
        // Сортируем по дате создания (последние первыми)
        allGenerations.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        
        // Показываем последние 10
        const recent = allGenerations.slice(0, 10);
        
        console.log('📋 Last 10 generations:\n');
        
        recent.forEach((gen, index) => {
            const statusEmoji = {
                'queued': '⏳',
                'processing': '🔄',
                'done': '✅',
                'failed': '❌'
            }[gen.status] || '❓';
            
            const createdAt = new Date(gen.createdAt);
            const now = new Date();
            const minutesAgo = Math.floor((now - createdAt) / 1000 / 60);
            
            console.log(`${index + 1}. ${statusEmoji} ${gen.status.toUpperCase()}`);
            console.log(`   ID: ${gen.generationId}`);
            console.log(`   User: ${gen.userId}`);
            console.log(`   Meme: ${gen.memeName}`);
            console.log(`   Name: ${gen.name}`);
            console.log(`   Time: ${minutesAgo} min ago (${createdAt.toLocaleString('ru-RU')})`);
            
            if (gen.status === 'done' && gen.videoUrl) {
                console.log(`   🎬 Video: ${gen.videoUrl.substring(0, 60)}...`);
            }
            
            if (gen.status === 'failed' && gen.error) {
                console.log(`   ❌ Error: ${gen.error.substring(0, 80)}...`);
            }
            
            console.log('');
        });
        
        // Статистика по статусам
        const stats = {
            queued: 0,
            processing: 0,
            done: 0,
            failed: 0
        };
        
        allGenerations.forEach(gen => {
            stats[gen.status] = (stats[gen.status] || 0) + 1;
        });
        
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📊 OVERALL STATISTICS\n');
        console.log(`Total: ${allGenerations.length}`);
        console.log(`✅ Done: ${stats.done} (${Math.round(stats.done / allGenerations.length * 100)}%)`);
        console.log(`❌ Failed: ${stats.failed} (${Math.round(stats.failed / allGenerations.length * 100)}%)`);
        console.log(`🔄 Processing: ${stats.processing}`);
        console.log(`⏳ Queued: ${stats.queued}`);
        
        // Последняя активность
        if (recent.length > 0) {
            const lastGen = recent[0];
            const lastTime = new Date(lastGen.createdAt);
            const minutesAgo = Math.floor((new Date() - lastTime) / 1000 / 60);
            
            console.log('\n⏰ Last activity:');
            console.log(`   ${minutesAgo} minutes ago`);
            console.log(`   User: ${lastGen.userId}`);
            console.log(`   Status: ${lastGen.status}`);
        }
        
    } catch (err) {
        console.error('❌ Error:', err.message);
    } finally {
        process.exit(0);
    }
}

checkRecentGenerations();
