import 'dotenv/config';
import { Telegraf } from 'telegraf';

const bot = new Telegraf(process.env.BOT_TOKEN);
const userId = 1048912079;

async function testSend() {
    try {
        console.log(`📤 Пытаюсь отправить сообщение пользователю ${userId}`);
        console.log(`🤖 Используя бота: ${process.env.BOT_NAME}`);
        console.log(`🔑 Токен: ${process.env.BOT_TOKEN?.substring(0, 20)}...`);
        console.log('');
        
        await bot.telegram.sendMessage(
            userId,
            '🧪 Тестовое сообщение от бота @' + process.env.BOT_NAME
        );
        
        console.log('✅ Сообщение успешно отправлено!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Ошибка при отправке:');
        console.error(`Код: ${error.response?.error_code}`);
        console.error(`Описание: ${error.response?.description || error.message}`);
        console.error('');
        
        if (error.response?.description?.includes('chat not found')) {
            console.log('💡 Причина: Пользователь не начинал диалог с этим ботом');
            console.log('   Он должен написать /start боту @' + process.env.BOT_NAME);
        } else if (error.response?.description?.includes('blocked')) {
            console.log('💡 Причина: Пользователь заблокировал бота');
        }
        
        process.exit(1);
    }
}

testSend();
