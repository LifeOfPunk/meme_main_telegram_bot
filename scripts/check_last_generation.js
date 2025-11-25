import 'dotenv/config';
import { GenerationService } from './src/services/Generation.service.js';
import redis from './src/redis.js';

const generationService = new GenerationService();

async function checkLastGeneration(userId = null) {
    console.log('🔍 Checking last generation...\n');
    
    try {
        if (userId) {
            // Проверяем генерации конкретного пользователя
            console.log(`👤 User ID: ${userId}\n`);
            const generations = await generationService.getUserGenerations(userId);
            
            if (generations.length === 0) {
                console.log('❌ No generations found for this user');
                return;
            }
            
            // Сортируем по дате создания (последние первыми)
            generations.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            
            console.log(`📊 Total generations: ${generations.length}\n`);
            
            // Показываем последние 5 генераций
            const lastGenerations = generations.slice(0, 5);
            
            console.log('📋 Last 5 generations:\n');
            lastGenerations.forEach((gen, index) => {
                const statusEmoji = {
                    'queued': '⏳',
                    'processing': '🔄',
                    'done': '✅',
                    'failed': '❌'
                }[gen.status] || '❓';
                
                console.log(`${index + 1}. ${statusEmoji} ${gen.status.toUpperCase()}`);
                console.log(`   ID: ${gen.generationId}`);
                console.log(`   Meme: ${gen.memeName}`);
                console.log(`   Name: ${gen.name}`);
                console.log(`   Created: ${new Date(gen.createdAt).toLocaleString('ru-RU')}`);
                
                if (gen.status === 'processing') {
                    const elapsed = Math.floor((Date.now() - new Date(gen.createdAt)) / 1000);
                    console.log(`   ⏱️  Processing time: ${elapsed}s`);
                }
                
                if (gen.status === 'done' && gen.videoUrl) {
                    console.log(`   🎬 Video: ${gen.videoUrl.substring(0, 50)}...`);
                }
                
                if (gen.status === 'failed' && gen.error) {
                    console.log(`   ❌ Error: ${gen.error}`);
                }
                
                console.log('');
            });
            
            // Детальная информация о последней генерации
            const lastGen = lastGenerations[0];
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log('📝 DETAILED INFO - LAST GENERATION\n');
            console.log(JSON.stringify(lastGen, null, 2));
            
        } else {
            // Показываем все активные генерации
            console.log('🔍 Checking all active generations...\n');
            
            const keys = await redis.keys('generation:*');
            console.log(`📊 Total generations in database: ${keys.length}\n`);
            
            const activeGenerations = [];
            
            for (const key of keys) {
                const data = await redis.get(key);
                if (data) {
                    const gen = JSON.parse(data);
                    if (gen.status === 'processing' || gen.status === 'queued') {
                        activeGenerations.push(gen);
                    }
                }
            }
            
            if (activeGenerations.length === 0) {
                console.log('✅ No active generations (all completed or failed)');
            } else {
                console.log(`⚡ Active generations: ${activeGenerations.length}\n`);
                
                activeGenerations.forEach((gen, index) => {
                    const statusEmoji = gen.status === 'processing' ? '🔄' : '⏳';
                    const elapsed = Math.floor((Date.now() - new Date(gen.createdAt)) / 1000);
                    
                    console.log(`${index + 1}. ${statusEmoji} ${gen.status.toUpperCase()}`);
                    console.log(`   ID: ${gen.generationId}`);
                    console.log(`   User: ${gen.userId}`);
                    console.log(`   Meme: ${gen.memeName}`);
                    console.log(`   Time: ${elapsed}s ago`);
                    console.log('');
                });
            }
            
            // Статистика
            const stats = await generationService.getGenerationStats();
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log('📊 STATISTICS\n');
            console.log(`Total: ${stats.total}`);
            console.log(`Queued: ${stats.queued}`);
            console.log(`Processing: ${stats.processing}`);
            console.log(`Done: ${stats.done}`);
            console.log(`Failed: ${stats.failed}`);
        }
        
    } catch (err) {
        console.error('❌ Error:', err.message);
    } finally {
        process.exit(0);
    }
}

// Получаем userId из аргументов командной строки
const userId = process.argv[2] ? parseInt(process.argv[2]) : null;

checkLastGeneration(userId);
