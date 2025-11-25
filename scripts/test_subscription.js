import 'dotenv/config.js';
import { Telegraf } from 'telegraf';

const bot = new Telegraf(process.env.BOT_TOKEN);
const channelId = process.env.REQUIRED_CHANNEL_ID;
const channelUsername = process.env.REQUIRED_CHANNEL || '@meemee_official';

async function testSubscription() {
    console.log('🧪 Тест проверки подписки\n');
    console.log(`📢 Канал: ${channelUsername}`);
    console.log(`🆔 ID канала: ${channelId}\n`);
    
    if (!channelId) {
        console.error('❌ REQUIRED_CHANNEL_ID не установлен в .env');
        process.exit(1);
    }
    
    // Запрашиваем ID пользователя для проверки
    const testUserId = process.argv[2];
    
    if (!testUserId) {
        console.log('💡 Использование: node scripts/test_subscription.js <USER_ID>');
        console.log('   Пример: node scripts/test_subscription.js 1323534384');
        process.exit(0);
    }
    
    console.log(`👤 Проверяем пользователя: ${testUserId}\n`);
    
    try {
        const member = await bot.telegram.getChatMember(channelId, testUserId);
        
        console.log('✅ Информация о подписке:');
        console.log(`   Статус: ${member.status}`);
        console.log(`   Пользователь: ${member.user.first_name} (@${member.user.username || 'N/A'})`);
        
        const isSubscribed = ['member', 'administrator', 'creator'].includes(member.status);
        
        console.log(`\n${isSubscribed ? '✅' : '❌'} Подписан: ${isSubscribed ? 'ДА' : 'НЕТ'}`);
        
        if (!isSubscribed) {
            console.log(`\n💡 Статус "${member.status}" не считается подпиской`);
            console.log('   Пользователь должен подписаться на канал');
        }
        
    } catch (err) {
        console.error('❌ Ошибка:', err.message);
        
        if (err.response?.error_code === 400) {
            console.log('\n💡 Возможные причины:');
            console.log('   1. Пользователь не подписан на канал');
            console.log('   2. Пользователь заблокировал бота');
            console.log('   3. Неверный ID пользователя');
        } else if (err.response?.error_code === 403) {
            console.log('\n💡 Бот не имеет доступа к каналу');
            console.log('   Добавьте бота в канал как администратора');
        }
    }
    
    process.exit(0);
}

testSubscription();
