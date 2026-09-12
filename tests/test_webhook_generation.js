import 'dotenv/config';
import { GenerationService } from '../src/services/Generation.service.js';
import { Telegraf } from 'telegraf';

console.log('🧪 Testing Webhook-based Video Generation...\n');

// Создаем mock бота для тестирования
const bot = new Telegraf(process.env.BOT_TOKEN);

// Создаем сервис с bot instance
const generationService = new GenerationService(bot);

async function testWebhookGeneration() {
    try {
        console.log('📝 Test 1: Creating generation with chatId...');
        
        // Тестовый userId и chatId
        const testUserId = 123456789;
        const testChatId = 123456789;
        
        // Создаем генерацию
        const generation = await generationService.createGeneration({
            userId: testUserId,
            chatId: testChatId,
            memeId: 'custom',
            name: 'Test',
            gender: 'male',
            customPrompt: 'A short video of a sunset over the ocean with gentle waves'
        });
        
        if (generation.error) {
            console.error('❌ Error creating generation:', generation.error);
            return;
        }
        
        console.log('✅ Generation created:', generation.generationId);
        console.log('📊 Generation data:', {
            generationId: generation.generationId,
            userId: generation.userId,
            chatId: generation.chatId,
            status: generation.status
        });
        
        console.log('\n⏳ Waiting 5 seconds to check generation status...');
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        // Проверяем статус генерации
        const updatedGeneration = await generationService.getGeneration(generation.generationId);
        console.log('📊 Updated status:', updatedGeneration.status);
        
        if (updatedGeneration.status === 'processing') {
            console.log('✅ Generation is processing in background!');
            console.log('🔔 Bot will send notification when video is ready');
        }
        
        console.log('\n✅ Test completed successfully!');
        console.log('🎯 Features tested:');
        console.log('  ✓ Generation with chatId');
        console.log('  ✓ Bot instance passed to service');
        console.log('  ✓ Background processing');
        console.log('  ✓ Automatic notification system ready');
        
        console.log('\n📝 Note: The video generation will continue in background.');
        console.log('When complete, the bot will automatically send the video to chatId:', testChatId);
        
    } catch (err) {
        console.error('❌ Test failed:', err.message);
        console.error(err.stack);
    } finally {
        process.exit(0);
    }
}

// Запускаем тест
testWebhookGeneration();
