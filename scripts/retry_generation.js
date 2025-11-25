import 'dotenv/config';
import { Telegraf } from 'telegraf';
import axios from 'axios';
import redis from './src/redis.js';

const bot = new Telegraf(process.env.BOT_TOKEN);
const taskId = '8023bfd386e873e8b5127f46daff69a0';
const generationId = 'GEN-1762269758181-834';

async function checkAndSendVideo() {
    try {
        console.log('🔍 Проверяю статус задачи:', taskId);
        
        // Проверяем статус через API
        const response = await axios.get(
            'https://api.kie.ai/api/v1/jobs/recordInfo',
            {
                params: { taskId },
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${process.env.KIE_AI_API_KEY}`
                }
            }
        );

        console.log('📥 Ответ API:', JSON.stringify(response.data, null, 2));

        const task = response.data.data;
        
        if (task.state === 'success' && task.resultJson) {
            const result = typeof task.resultJson === 'string' 
                ? JSON.parse(task.resultJson) 
                : task.resultJson;
            const videoUrl = result.resultUrls && result.resultUrls.length > 0 
                ? result.resultUrls[0] 
                : null;
            
            console.log('✅ Видео готово!');
            console.log('🎬 URL:', videoUrl);
            
            // Получаем данные генерации из Redis
            const generationData = await redis.get(`generation:${generationId}`);
            const generation = JSON.parse(generationData);
            
            console.log('👤 Отправляю пользователю:', generation.userId);
            
            // Обновляем статус в Redis
            generation.status = 'done';
            generation.videoUrl = videoUrl;
            generation.updatedAt = new Date().toISOString();
            await redis.set(`generation:${generationId}`, JSON.stringify(generation));
            
            // Отправляем видео
            await bot.telegram.sendVideo(
                generation.chatId,
                videoUrl,
                {
                    caption: `✅ Ваше видео готово!\n\n🎬 ${generation.memeName}\n👤 Имя: ${generation.name}\n\n⚠️ ВАЖНО: Сохраните видео прямо сейчас!\nЕсли переписка будет потеряна, видео не восстановится.`
                }
            );
            
            console.log('✅ Видео успешно отправлено!');
            
        } else {
            console.log('⏳ Статус:', task.state);
            console.log('Видео еще не готово');
        }
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Ошибка:', error.message);
        if (error.response) {
            console.error('API Response:', error.response.data);
        }
        process.exit(1);
    }
}

checkAndSendVideo();
