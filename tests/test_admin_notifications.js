import 'dotenv/config';
import { Telegraf } from 'telegraf';
import { errorLogger } from './src/services/ErrorLogger.service.js';
import { ADMINS } from './src/config.js';

console.log('🧪 Testing Admin Notifications...\n');

async function testAdminNotifications() {
    try {
        console.log('📝 Test: Simulating a real error and notifying admins...\n');
        
        // Создаем тестовую ошибку
        const testError = {
            message: 'ТЕСТОВАЯ ОШИБКА: Проверка системы уведомлений',
            stack: `Error: Test error for admin notification
    at testFunction (test.js:10:15)
    at main (index.js:25:8)
    at startup (app.js:5:3)`,
            name: 'TestError',
            source: 'Test Script',
            context: {
                userId: 999999999,
                testMode: true
            }
        };
        
        // Логируем ошибку
        const loggedError = await errorLogger.logError(testError);
        console.log('✅ Error logged:', loggedError.id);
        
        // Отправляем уведомления админам
        if (!process.env.BOT_TOKEN_ADMIN || !ADMINS || ADMINS.length === 0) {
            console.log('⚠️ No admin bot token or admins configured');
            console.log('   Set BOT_TOKEN_ADMIN and ADMINS in config to receive notifications');
            process.exit(0);
        }
        
        const adminBot = new Telegraf(process.env.BOT_TOKEN_ADMIN);
        
        const time = new Date().toLocaleString('ru-RU');
        let message = `🔴 ТЕСТОВАЯ ОШИБКА\n\n`;
        message += `⏰ Время: ${time}\n`;
        message += `❌ Тип: ${testError.name}\n`;
        message += `💬 Сообщение: ${testError.message}\n`;
        message += `📍 Источник: ${testError.source}\n\n`;
        message += `📝 Stack:\n${testError.stack.split('\n').slice(0, 3).join('\n')}`;
        
        console.log('📤 Sending notifications to admins:', ADMINS);
        
        for (const adminId of ADMINS) {
            try {
                await adminBot.telegram.sendMessage(adminId, message, {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '❌ Посмотреть все ошибки', url: `https://t.me/${process.env.BOT_NAME || 'your_admin_bot'}` }]
                        ]
                    }
                });
                console.log(`✅ Notification sent to admin ${adminId}`);
            } catch (sendErr) {
                console.error(`❌ Failed to notify admin ${adminId}:`, sendErr.message);
            }
        }
        
        console.log('\n✅ Test completed!');
        console.log('📱 Check admin bot to see:');
        console.log('   1. Real-time notification message');
        console.log('   2. Error in "❌ ОШИБКИ" section');
        
    } catch (err) {
        console.error('❌ Test failed:', err.message);
        console.error(err.stack);
    } finally {
        process.exit(0);
    }
}

testAdminNotifications();
