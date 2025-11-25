import 'dotenv/config.js';
import { Telegraf } from 'telegraf';

const bot = new Telegraf(process.env.BOT_TOKEN);

async function getChannelId() {
    const channelUsername = process.env.REQUIRED_CHANNEL || '@meemee_official';
    
    console.log(`🔍 Получение ID канала ${channelUsername}...\n`);
    
    try {
        const chat = await bot.telegram.getChat(channelUsername);
        
        console.log('✅ Информация о канале:');
        console.log(`   ID: ${chat.id}`);
        console.log(`   Название: ${chat.title}`);
        console.log(`   Username: @${chat.username}`);
        console.log(`   Тип: ${chat.type}`);
        
        console.log('\n📝 Добавьте в .env:');
        console.log(`REQUIRED_CHANNEL_ID=${chat.id}`);
        
    } catch (err) {
        console.error('❌ Ошибка:', err.message);
        console.log('\n💡 Убедитесь что:');
        console.log('   1. Бот добавлен в канал как администратор');
        console.log('   2. Username канала указан правильно');
        console.log('   3. Канал публичный или бот имеет доступ');
    }
    
    process.exit(0);
}

getChannelId();
