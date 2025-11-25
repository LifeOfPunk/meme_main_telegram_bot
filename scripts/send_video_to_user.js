import 'dotenv/config';
import { Telegraf } from 'telegraf';
import { GenerationService } from './src/services/Generation.service.js';

const bot = new Telegraf(process.env.BOT_TOKEN);
const generationService = new GenerationService();

async function sendVideoToUser(userId, generationId = null) {
    console.log(`📤 Sending video to user ${userId}...\n`);
    
    try {
        let videoUrl;
        let generation;
        
        if (generationId) {
            // Отправляем конкретную генерацию
            generation = await generationService.getGeneration(generationId);
            if (!generation) {
                console.log('❌ Generation not found');
                return;
            }
            videoUrl = generation.videoUrl;
        } else {
            // Отправляем последнюю успешную генерацию
            const generations = await generationService.getUserGenerations(userId);
            const lastVideo = generations.find(g => g.status === 'done' && g.videoUrl);
            
            if (!lastVideo) {
                console.log('❌ No completed videos found for this user');
                return;
            }
            
            generation = lastVideo;
            videoUrl = lastVideo.videoUrl;
        }
        
        if (!videoUrl) {
            console.log('❌ Video URL not found');
            return;
        }
        
        console.log('📋 Generation info:');
        console.log(`   ID: ${generation.generationId}`);
        console.log(`   Meme: ${generation.memeName}`);
        console.log(`   Status: ${generation.status}`);
        console.log(`   Video URL: ${videoUrl}\n`);
        
        console.log('📤 Attempting to send video...\n');
        
        try {
            // Пытаемся отправить видео
            await bot.telegram.sendVideo(
                userId,
                { url: videoUrl },
                { 
                    caption: '✅ Ваше видео готово!\n\n🎬 Генерация успешно завершена!\n\n⚠️ ВАЖНО: Сохраните видео прямо сейчас!',
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '👥 Поделиться с другом', switch_inline_query: '' }],
                            [{ text: '🎬 Создать ещё', callback_data: 'catalog' }],
                            [{ text: '🏠 Главное меню', callback_data: 'main_menu' }]
                        ]
                    }
                }
            );
            console.log('✅ Video sent successfully!');
        } catch (videoErr) {
            console.error('❌ Failed to send video file:', videoErr.message);
            console.log('\n📤 Trying to send as link instead...\n');
            
            // Если не удалось отправить видео, отправляем ссылку
            await bot.telegram.sendMessage(
                userId,
                `✅ Ваше видео готово!\n\n🎬 Генерация успешно завершена!\n\n🔗 Ссылка на видео: ${videoUrl}\n\n⚠️ ВАЖНО: Сохраните видео прямо сейчас!`,
                {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '👥 Поделиться с другом', switch_inline_query: '' }],
                            [{ text: '🎬 Создать ещё', callback_data: 'catalog' }],
                            [{ text: '🏠 Главное меню', callback_data: 'main_menu' }]
                        ]
                    }
                }
            );
            console.log('✅ Link sent successfully!');
        }
        
    } catch (err) {
        console.error('❌ Error:', err.message);
        console.error(err.stack);
    } finally {
        process.exit(0);
    }
}

// Получаем параметры из командной строки
const userId = process.argv[2] ? parseInt(process.argv[2]) : null;
const generationId = process.argv[3] || null;

if (!userId) {
    console.log('Usage: node send_video_to_user.js USER_ID [GENERATION_ID]');
    console.log('');
    console.log('Examples:');
    console.log('  node send_video_to_user.js 1323534384');
    console.log('  node send_video_to_user.js 1323534384 GEN-1762275133526-6618');
    process.exit(1);
}

sendVideoToUser(userId, generationId);
