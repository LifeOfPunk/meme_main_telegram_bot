import 'dotenv/config';
import { Telegraf } from 'telegraf';
import { UserService } from '../src/services/User.service.js';

const bot = new Telegraf(process.env.BOT_TOKEN);
const userService = new UserService();

async function updateUsernames() {
    console.log('🔄 Обновление username пользователей...\n');
    
    try {
        // Получаем всех пользователей
        const users = await userService.getAllUsers();
        console.log(`📊 Найдено пользователей: ${users.length}\n`);
        
        let updated = 0;
        let failed = 0;
        let noChange = 0;
        
        for (const user of users) {
            try {
                // Получаем актуальную информацию из Telegram
                const chatInfo = await bot.telegram.getChat(user.userId);
                
                const oldUsername = user.username;
                const newUsername = chatInfo.username || null;
                
                // Обновляем только если username изменился
                if (oldUsername !== newUsername) {
                    await userService.updateUser(user.userId, {
                        username: newUsername,
                        firstName: chatInfo.first_name || user.firstName,
                        lastName: chatInfo.last_name || user.lastName
                    });
                    
                    console.log(`✅ ${user.userId}: "${oldUsername || 'N/A'}" → "${newUsername || 'N/A'}"`);
                    updated++;
                } else {
                    noChange++;
                }
                
                // Небольшая задержка чтобы не словить rate limit
                await new Promise(resolve => setTimeout(resolve, 100));
                
            } catch (err) {
                if (err.response?.error_code === 403) {
                    console.log(`⚠️  ${user.userId}: Бот заблокирован пользователем`);
                } else if (err.response?.error_code === 400) {
                    console.log(`⚠️  ${user.userId}: Пользователь не найден`);
                } else {
                    console.log(`❌ ${user.userId}: ${err.message}`);
                }
                failed++;
            }
        }
        
        console.log('\n' + '='.repeat(60));
        console.log('📊 ИТОГИ:');
        console.log('='.repeat(60));
        console.log(`✅ Обновлено: ${updated}`);
        console.log(`➖ Без изменений: ${noChange}`);
        console.log(`❌ Ошибок: ${failed}`);
        console.log(`📊 Всего обработано: ${users.length}`);
        console.log('='.repeat(60));
        
    } catch (err) {
        console.error('❌ Критическая ошибка:', err);
    }
    
    process.exit(0);
}

updateUsernames();
