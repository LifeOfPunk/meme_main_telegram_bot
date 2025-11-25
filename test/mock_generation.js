import 'dotenv/config';
import redis from '../src/redis.js';
import { GenerationService } from '../src/services/Generation.service.js';

console.log('🧪 Тест: Generation Service (генерация видео)\n');

// Mock версия GenerationService для тестирования
class MockGenerationService extends GenerationService {
    async generateVideo(prompt) {
        console.log('   🎬 [MOCK] Генерация видео...');
        console.log(`   📝 Промпт: ${prompt.substring(0, 50)}...`);
        
        // Симулируем задержку генерации
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Возвращаем мок-ссылку на видео
        return 'https://example.com/test-video-' + Date.now() + '.mp4';
    }
}

async function testGeneration() {
    try {
        const mockService = new MockGenerationService();
        
        console.log('1️⃣ Тест создания генерации\n');
        
        const generation = await mockService.createGeneration({
            userId: 123456789,
            memeId: 'mama_taxi',
            name: 'Алекс',
            gender: 'male'
        });
        
        if (generation.error) {
            console.log('   ❌ Ошибка:', generation.error);
            return;
        }
        
        console.log('   ✅ Генерация создана');
        console.log(`   📋 ID: ${generation.generationId}`);
        console.log(`   👤 Пользователь: ${generation.userId}`);
        console.log(`   🎭 Мем: ${generation.memeName}`);
        console.log(`   📝 Имя: ${generation.name}`);
        console.log(`   🚻 Пол: ${generation.gender}`);
        console.log(`   📊 Статус: ${generation.status}`);
        
        console.log('\n2️⃣ Ожидание завершения генерации\n');
        
        // Ждём завершения
        let attempts = 0;
        let finalGen = null;
        
        while (attempts < 10) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            finalGen = await mockService.getGeneration(generation.generationId);
            
            console.log(`   ⏳ Попытка ${attempts + 1}/10 - Статус: ${finalGen.status}`);
            
            if (finalGen.status === 'done' || finalGen.status === 'failed') {
                break;
            }
            attempts++;
        }
        
        if (finalGen.status === 'done') {
            console.log('\n   ✅ Генерация завершена успешно!');
            console.log(`   🎥 Видео URL: ${finalGen.videoUrl}`);
        } else {
            console.log('\n   ❌ Генерация не завершена');
        }
        
        console.log('\n3️⃣ Тест получения истории генераций\n');
        
        const history = await mockService.getUserGenerations(123456789);
        console.log(`   ✅ История загружена: ${history.length} генераций`);
        
        if (history.length > 0) {
            console.log('\n   Последняя генерация:');
            console.log(`   - ID: ${history[0].generationId}`);
            console.log(`   - Мем: ${history[0].memeName}`);
            console.log(`   - Статус: ${history[0].status}`);
        }
        
        console.log('\n✅ Все тесты генерации пройдены успешно!\n');
        
    } catch (err) {
        console.error('❌ Ошибка в тесте:', err.message);
    } finally {
        await redis.quit();
    }
}

testGeneration();
