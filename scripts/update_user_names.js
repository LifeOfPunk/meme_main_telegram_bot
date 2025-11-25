import 'dotenv/config';
import TelegramBot from 'node-telegram-bot-api';
import { UserService } from './src/services/User.service.js';

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN);
const userService = new UserService();

async function updateUserNames() {
    try {
        console.log('🔄 Starting user names update...\n');
        
        // Получаем всех пользователей из БД
        const users = await userService.getAllUsers();
        console.log(`📊 Found ${users.length} users in database\n`);
        
        let updated = 0;
        let skipped = 0;
        let errors = 0;
        
        for (const user of users) {
            try {
                // Если имя уже есть и не "не указано", пропускаем
                if (user.firstName && user.firstName !== 'не указано') {
                    console.log(`✓ User ${user.userId} already has name: ${user.firstName}`);
                    skipped++;
                    continue;
                }
                
                // Получаем информацию о пользователе из Telegram
                const chatInfo = await bot.getChat(user.userId);
                
                if (chatInfo.first_name) {
                    // Обновляем имя в БД
                    await userService.updateUserField(user.userId, 'firstName', chatInfo.first_name);
                    console.log(`✅ Updated user ${user.userId}: ${chatInfo.first_name}`);
                    updated++;
                } else {
                    console.log(`⚠️  User ${user.userId} has no first_name in Telegram`);
                    skipped++;
                }
                
                // Небольшая задержка, чтобы не превысить лимиты API
                await new Promise(resolve => setTimeout(resolve, 100));
                
            } catch (err) {
                console.error(`❌ Error updating user ${user.userId}: ${err.message}`);
                errors++;
            }
        }
        
        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📊 Update Summary:');
        console.log(`✅ Updated: ${updated}`);
        console.log(`⚠️  Skipped: ${skipped}`);
        console.log(`❌ Errors: ${errors}`);
        console.log(`📝 Total: ${users.length}`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        
        process.exit(0);
    } catch (err) {
        console.error('❌ Fatal error:', err);
        process.exit(1);
    }
}

updateUserNames();
