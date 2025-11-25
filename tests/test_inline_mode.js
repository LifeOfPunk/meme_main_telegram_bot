import 'dotenv/config';
import { Telegraf } from 'telegraf';

const bot = new Telegraf(process.env.BOT_TOKEN);

async function testInlineMode() {
    console.log('🧪 Testing inline mode configuration...\n');
    
    try {
        // Получаем информацию о боте
        const botInfo = await bot.telegram.getMe();
        
        console.log('🤖 Bot Info:');
        console.log(`   Username: @${botInfo.username}`);
        console.log(`   ID: ${botInfo.id}`);
        console.log(`   Name: ${botInfo.first_name}`);
        console.log(`   Inline queries: ${botInfo.supports_inline_queries ? '✅ ENABLED' : '❌ DISABLED'}`);
        
        if (!botInfo.supports_inline_queries) {
            console.log('\n⚠️  ПРОБЛЕМА: Inline режим не включен!');
            console.log('\n📝 Как включить:');
            console.log('   1. Открой @BotFather в Telegram');
            console.log('   2. Отправь команду /mybots');
            console.log('   3. Выбери своего бота @' + botInfo.username);
            console.log('   4. Нажми "Bot Settings"');
            console.log('   5. Нажми "Inline Mode"');
            console.log('   6. Нажми "Turn on"');
            console.log('   7. Опционально: установи Inline Feedback на 100%');
        } else {
            console.log('\n✅ Inline режим включен и работает!');
            console.log('\n💡 Теперь пользователи могут:');
            console.log('   1. Нажать кнопку "👥 Поделиться с другом"');
            console.log('   2. Выбрать чат');
            console.log('   3. Видео будет отправлено в выбранный чат');
        }
        
    } catch (err) {
        console.error('❌ Error:', err.message);
    } finally {
        process.exit(0);
    }
}

testInlineMode();
