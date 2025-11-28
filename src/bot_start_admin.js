import 'dotenv/config';
import { Telegraf, session, Input } from 'telegraf';
import { UserService } from './services/User.service.js';
import { OrderService } from './services/Order.service.js';
import { GenerationService } from './services/Generation.service.js';
import { ReferralService } from './services/Referral.service.js';
import { errorLogger } from './services/ErrorLogger.service.js';
import { ADMINS } from './config.js';
import axios from 'axios';
import redis from './redis.js';

if (!process.env.BOT_TOKEN_ADMIN) {
    console.error('❌ BOT_TOKEN_ADMIN not found in .env file');
    process.exit(1);
}

if (!process.env.BOT_TOKEN) {
    console.error('❌ BOT_TOKEN not found in .env file (needed for broadcast)');
    process.exit(1);
}

const bot = new Telegraf(process.env.BOT_TOKEN_ADMIN);
console.log(`✅ Admin bot initialized with token: ${process.env.BOT_TOKEN_ADMIN?.substring(0, 10)}...`);

// Создаём отдельный экземпляр для рассылки через основной бот
const mainBot = new Telegraf(process.env.BOT_TOKEN);
console.log(`✅ Main bot initialized with token: ${process.env.BOT_TOKEN?.substring(0, 10)}...`);

const userService = new UserService();
const orderService = new OrderService();
const generationService = new GenerationService();
const referralService = new ReferralService();

// Админское меню
const ADMIN_MENU = {
    reply_markup: {
        inline_keyboard: [
            [{ text: '📊 Статистика', callback_data: 'stats' }],
            [{ text: '👥 Пользователи', callback_data: 'users' }],
            [{ text: '💳 Платежи', callback_data: 'payments' }],
            [{ text: '📢 Рассылка', callback_data: 'broadcast' }],
            [{ text: '💼 Эксперты', callback_data: 'experts' }],
            [{ text: '📥 Экспорт отчётов', callback_data: 'export_reports' }],
            [{ text: '❌ Ошибки', callback_data: 'errors' }]
        ]
    }
};

// Session middleware
bot.use(session());

// Middleware для проверки админа
bot.use(async (ctx, next) => {
    const userId = ctx.from?.id;
    console.log(`🔍 Admin bot: User ${userId} trying to access. ADMINS list:`, ADMINS);
    console.log(`🔍 Is admin: ${ADMINS.includes(userId)}`);
    
    if (!userId || !ADMINS.includes(userId)) {
        console.log(`⛔ Access denied for user ${userId}`);
        return await ctx.reply('❌ Доступ запрещён');
    }
    
    console.log(`✅ Access granted for admin ${userId}`);
    await next();
});

// Обработка видео
bot.on('video', async (ctx) => {
    try {
        if (!ctx.session) ctx.session = {};
        
        if (ctx.session.broadcast && ctx.session.broadcast.step === 'content') {
            const video = ctx.message.video;
            const caption = ctx.message.caption || '';
            
            console.log(`🎬 Video received: file_id=${video.file_id}, size=${video.file_size}, caption="${caption}"`);
            
            try {
                // Скачиваем видео через админ-бота
                console.log('⬇️ Downloading video...');
                const fileLink = await ctx.telegram.getFileLink(video.file_id);
                const response = await axios.get(fileLink.href, { responseType: 'arraybuffer' });
                const videoBuffer = Buffer.from(response.data);
                
                console.log(`✅ Video downloaded: ${videoBuffer.length} bytes`);
                
                // Сохраняем Buffer напрямую
                ctx.session.broadcast.videoBuffer = videoBuffer;
                ctx.session.broadcast.text = caption;
                ctx.session.broadcast.step = 'button_choice';
                
                await ctx.reply(
                    '📢 Шаг 2: Добавить кнопку?',
                    {
                        reply_markup: {
                            inline_keyboard: [
                                [{ text: '✅ Да', callback_data: 'broadcast_add_button' }],
                                [{ text: '⏭️ Нет', callback_data: 'broadcast_skip_button' }],
                                [{ text: '🔙 Отмена', callback_data: 'main_menu' }]
                            ]
                        }
                    }
                );
            } catch (err) {
                console.error('❌ Error downloading video:', err);
                await ctx.reply('❌ Ошибка при обработке видео. Попробуйте ещё раз.');
            }
        }
    } catch (err) {
        console.error('❌ Error in video handler:', err);
        await ctx.reply('Произошла ошибка при обработке видео');
    }
});

// Команда /start - ДОЛЖНА БЫТЬ ПЕРЕД bot.on('text')
bot.start(async (ctx) => {
    console.log(`🚀 /start command received from user ${ctx.from.id}`);
    try {
        await ctx.reply(
            '👨‍💼 Админ-панель MeeMee\n\nВыберите действие:',
            ADMIN_MENU
        );
        console.log(`✅ Start menu sent to user ${ctx.from.id}`);
    } catch (err) {
        console.error(`❌ Error sending start menu:`, err);
    }
});

// УДАЛЕНО - объединено с основным обработчиком текста ниже

// Главное меню
bot.action('main_menu', async (ctx) => {
    try {
        await ctx.editMessageText(
            '👨‍💼 Админ-панель MeeMee\n\nВыберите действие:',
            ADMIN_MENU
        );
    } catch (err) {
        await ctx.reply('👨‍💼 Админ-панель MeeMee\n\nВыберите действие:', ADMIN_MENU);
    }
});

// Статистика
bot.action('stats', async (ctx) => {
    try {
        const totalUsers = await userService.getTotalUsers();
        const paymentStats = await orderService.getPaymentStats();
        const generationStats = await generationService.getGenerationStats();

        let message = '📊 Общая статистика:\n\n';
        message += `👥 Всего пользователей: ${totalUsers}\n\n`;
        
        message += `💳 Платежи:\n`;
        message += `├─ Всего заказов: ${paymentStats.total}\n`;
        message += `├─ Оплачено: ${paymentStats.paid}\n`;
        message += `├─ В ожидании: ${paymentStats.unpaid}\n`;
        message += `├─ Крипто: ${paymentStats.crypto}\n`;
        message += `├─ Карты: ${paymentStats.fiat}\n`;
        message += `└─ Общая выручка:\n`;
        message += `   ├─ 💵 Карты: ${paymentStats.fiatRevenue.toFixed(2)}₽\n`;
        
        // Показываем крипто только если есть данные
        const hasCrypto = paymentStats.cryptoRevenue.usdt > 0 || 
                         paymentStats.cryptoRevenue.usdc > 0 || 
                         paymentStats.cryptoRevenue.ton > 0 ||
                         paymentStats.cryptoRevenue.count.usdt > 0 ||
                         paymentStats.cryptoRevenue.count.usdc > 0 ||
                         paymentStats.cryptoRevenue.count.ton > 0;
        
        if (hasCrypto) {
            message += `   └─ 💎 Крипто:\n`;
            if (paymentStats.cryptoRevenue.count.usdt > 0) {
                message += `      ├─ USDT: ${paymentStats.cryptoRevenue.usdt.toFixed(2)} (${paymentStats.cryptoRevenue.count.usdt} шт)\n`;
            }
            if (paymentStats.cryptoRevenue.count.usdc > 0) {
                message += `      ├─ USDC: ${paymentStats.cryptoRevenue.usdc.toFixed(2)} (${paymentStats.cryptoRevenue.count.usdc} шт)\n`;
            }
            if (paymentStats.cryptoRevenue.count.ton > 0) {
                message += `      └─ TON: ${paymentStats.cryptoRevenue.ton.toFixed(2)} (${paymentStats.cryptoRevenue.count.ton} шт)\n`;
            }
        } else {
            message += `   └─ 💎 Крипто: 0₽\n`;
        }
        message += `\n`;
        
        message += `🎬 Генерации:\n`;
        message += `├─ Всего: ${generationStats.total}\n`;
        message += `├─ В очереди: ${generationStats.queued}\n`;
        message += `├─ Обрабатываются: ${generationStats.processing}\n`;
        message += `├─ Завершено: ${generationStats.done}\n`;
        message += `└─ Ошибок: ${generationStats.failed}`;

        await ctx.editMessageText(message, {
            reply_markup: {
                inline_keyboard: [
                    [{ text: '📊 UTM источники', callback_data: 'utm_stats' }],
                    [{ text: '🔙 Назад', callback_data: 'main_menu' }]
                ]
            }
        });
    } catch (err) {
        console.error('❌ Error in stats:', err);
        await ctx.answerCbQuery('Ошибка получения статистики');
    }
});

// UTM статистика
bot.action('utm_stats', async (ctx) => {
    try {
        // Получаем всех пользователей
        const allUserIds = await redis.smembers('all_users');
        
        let stats = {
            total: allUserIds.length,
            tiktok: 0,
            instagram: 0,
            youtube: 0,
            noSource: 0
        };
        
        // Подсчитываем статистику
        for (const uid of allUserIds) {
            const user = await userService.getUser(parseInt(uid));
            if (user) {
                if (user.source === 'tiktok') stats.tiktok++;
                else if (user.source === 'instagram') stats.instagram++;
                else if (user.source === 'youtube') stats.youtube++;
                else stats.noSource++;
            }
        }
        
        const message = `📊 *Статистика по UTM источникам*\n\n` +
            `👥 Всего пользователей: ${stats.total}\n\n` +
            `🎵 TikTok: ${stats.tiktok} (${stats.total > 0 ? ((stats.tiktok/stats.total)*100).toFixed(1) : 0}%)\n` +
            `📸 Instagram: ${stats.instagram} (${stats.total > 0 ? ((stats.instagram/stats.total)*100).toFixed(1) : 0}%)\n` +
            `📺 YouTube: ${stats.youtube} (${stats.total > 0 ? ((stats.youtube/stats.total)*100).toFixed(1) : 0}%)\n` +
            `❓ Без источника: ${stats.noSource} (${stats.total > 0 ? ((stats.noSource/stats.total)*100).toFixed(1) : 0}%)`;
        
        await ctx.editMessageText(message, {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [{ text: '🔙 Назад к статистике', callback_data: 'stats' }],
                    [{ text: '🏠 Главное меню', callback_data: 'main_menu' }]
                ]
            }
        });
    } catch (err) {
        console.error('❌ Error in utm_stats:', err);
        await ctx.answerCbQuery('Ошибка получения статистики');
    }
});

// Статистика платежей
bot.action('payments', async (ctx) => {
    try {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
        const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

        const allOrders = await orderService.getAllOrders();
        
        const todayOrders = allOrders.filter(o => new Date(o.createdAt) >= today);
        const weekOrders = allOrders.filter(o => new Date(o.createdAt) >= weekAgo);
        const monthOrders = allOrders.filter(o => new Date(o.createdAt) >= monthAgo);

        let message = '💳 Статистика платежей:\n\n';
        
        message += `📅 За сегодня:\n`;
        message += `├─ Заказов: ${todayOrders.length}\n`;
        message += `├─ Оплачено: ${todayOrders.filter(o => o.isPaid).length}\n`;
        message += `└─ Выручка: ${todayOrders.filter(o => o.isPaid).reduce((sum, o) => sum + (o.amount || 0), 0).toFixed(2)}₽\n\n`;
        
        message += `📅 За неделю:\n`;
        message += `├─ Заказов: ${weekOrders.length}\n`;
        message += `├─ Оплачено: ${weekOrders.filter(o => o.isPaid).length}\n`;
        message += `└─ Выручка: ${weekOrders.filter(o => o.isPaid).reduce((sum, o) => sum + (o.amount || 0), 0).toFixed(2)}₽\n\n`;
        
        message += `📅 За месяц:\n`;
        message += `├─ Заказов: ${monthOrders.length}\n`;
        message += `├─ Оплачено: ${monthOrders.filter(o => o.isPaid).length}\n`;
        message += `└─ Выручка: ${monthOrders.filter(o => o.isPaid).reduce((sum, o) => sum + (o.amount || 0), 0).toFixed(2)}₽\n\n`;
        
        const cryptoOrders = allOrders.filter(o => !o.isFiat && o.isPaid);
        const fiatOrders = allOrders.filter(o => o.isFiat && o.isPaid);
        
        // Разделяем крипто по валютам (используем currency или crypto)
        const usdtOrders = cryptoOrders.filter(o => (o.crypto || o.currency || '').includes('USDT'));
        const usdcOrders = cryptoOrders.filter(o => (o.crypto || o.currency || '').includes('USDC'));
        const tonOrders = cryptoOrders.filter(o => (o.crypto || o.currency || '').includes('TON'));
        
        message += `💎 Крипто: ${cryptoOrders.length}\n`;
        if (usdtOrders.length > 0) {
            message += `   ├─ USDT: ${usdtOrders.reduce((sum, o) => sum + (o.cryptoAmount || 0), 0).toFixed(2)} (${usdtOrders.length} шт)\n`;
        }
        if (usdcOrders.length > 0) {
            message += `   ├─ USDC: ${usdcOrders.reduce((sum, o) => sum + (o.cryptoAmount || 0), 0).toFixed(2)} (${usdcOrders.length} шт)\n`;
        }
        if (tonOrders.length > 0) {
            message += `   └─ TON: ${tonOrders.reduce((sum, o) => sum + (o.cryptoAmount || 0), 0).toFixed(2)} (${tonOrders.length} шт)\n`;
        }
        message += `💵 Карты: ${fiatOrders.length} (${fiatOrders.reduce((sum, o) => sum + (o.amount || 0), 0).toFixed(2)}₽)`;

        await ctx.editMessageText(message, {
            reply_markup: {
                inline_keyboard: [
                    [{ text: '🔙 Назад', callback_data: 'main_menu' }]
                ]
            }
        });
    } catch (err) {
        console.error('❌ Error in payments:', err);
        await ctx.answerCbQuery('Ошибка получения статистики');
    }
});

// Статистика генераций
bot.action('generations', async (ctx) => {
    try {
        const generationStats = await generationService.getGenerationStats();
        const topMemes = await generationService.getTopMemes();

        let message = '🎬 Статистика генераций:\n\n';
        message += `📊 Общая:\n`;
        message += `├─ Всего: ${generationStats.total}\n`;
        message += `├─ В очереди: ${generationStats.queued}\n`;
        message += `├─ Обрабатываются: ${generationStats.processing}\n`;
        message += `├─ Завершено: ${generationStats.done}\n`;
        message += `└─ Ошибок: ${generationStats.failed}\n\n`;

        if (topMemes.length > 0) {
            message += `🏆 Топ мемов:\n`;
            topMemes.forEach((meme, index) => {
                message += `${index + 1}. ${meme.memeName}: ${meme.count}\n`;
            });
        }

        await ctx.editMessageText(message, {
            reply_markup: {
                inline_keyboard: [
                    [{ text: '🔙 Назад', callback_data: 'main_menu' }]
                ]
            }
        });
    } catch (err) {
        console.error('❌ Error in generations:', err);
        await ctx.answerCbQuery('Ошибка получения статистики');
    }
});

// Ошибки системы
bot.action('errors', async (ctx) => {
    try {
        const errorStats = await errorLogger.getErrorStats();
        const recentErrors = await errorLogger.getAllErrors(10);

        let message = '❌ ОШИБКИ СИСТЕМЫ\n\n';
        message += `📊 Статистика:\n`;
        message += `├─ Всего: ${errorStats.total}\n`;
        message += `├─ За сегодня: ${errorStats.today}\n`;
        message += `└─ За неделю: ${errorStats.week}\n\n`;

        if (Object.keys(errorStats.byType).length > 0) {
            message += `📋 По типам:\n`;
            Object.entries(errorStats.byType).forEach(([type, count]) => {
                message += `├─ ${type}: ${count}\n`;
            });
            message += `\n`;
        }

        if (recentErrors.length > 0) {
            message += `🔴 Последние ошибки:\n\n`;
            recentErrors.slice(0, 5).forEach((error, index) => {
                const time = new Date(error.timestamp).toLocaleString('ru-RU');
                const msg = error.message.substring(0, 50);
                message += `${index + 1}. [${time}]\n`;
                message += `   ${msg}${error.message.length > 50 ? '...' : ''}\n\n`;
            });
        } else {
            message += `✅ Нет ошибок`;
        }

        await ctx.editMessageText(message, {
            reply_markup: {
                inline_keyboard: [
                    [{ text: '📋 Все ошибки', callback_data: 'errors_all' }],
                    [{ text: '🗑️ Очистить', callback_data: 'errors_clear' }],
                    [{ text: '🔙 Назад', callback_data: 'main_menu' }]
                ]
            }
        });
    } catch (err) {
        console.error('❌ Error in errors handler:', err);
        await ctx.answerCbQuery('Ошибка получения данных');
    }
});

// Все ошибки (детально)
bot.action('errors_all', async (ctx) => {
    try {
        const errors = await errorLogger.getAllErrors(20);

        if (errors.length === 0) {
            await ctx.editMessageText('✅ Нет ошибок', {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '🔙 Назад', callback_data: 'errors' }]
                    ]
                }
            });
            return;
        }

        let message = `❌ ВСЕ ОШИБКИ (последние ${errors.length}):\n\n`;

        errors.forEach((error, index) => {
            const time = new Date(error.timestamp).toLocaleString('ru-RU', {
                day: '2-digit',
                month: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            });
            message += `${index + 1}. [${time}] ${error.type}\n`;
            message += `   ${error.message.substring(0, 80)}\n`;
            if (error.source && error.source !== 'unknown') {
                message += `   📍 ${error.source}\n`;
            }
            message += `\n`;
        });

        await ctx.editMessageText(message, {
            reply_markup: {
                inline_keyboard: [
                    [{ text: '🔙 Назад', callback_data: 'errors' }]
                ]
            }
        });
    } catch (err) {
        console.error('❌ Error in errors_all:', err);
        await ctx.answerCbQuery('Ошибка получения данных');
    }
});

// Очистка ошибок
bot.action('errors_clear', async (ctx) => {
    try {
        await ctx.editMessageText(
            '🗑️ Очистить все ошибки?\n\nЭто действие необратимо!',
            {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '✅ Да, очистить', callback_data: 'errors_clear_confirm' }],
                        [{ text: '❌ Отмена', callback_data: 'errors' }]
                    ]
                }
            }
        );
    } catch (err) {
        console.error('❌ Error in errors_clear:', err);
        await ctx.answerCbQuery('Ошибка');
    }
});

// Подтверждение очистки ошибок
bot.action('errors_clear_confirm', async (ctx) => {
    try {
        await errorLogger.clearAllErrors();
        await ctx.answerCbQuery('✅ Все ошибки очищены');
        
        await ctx.editMessageText(
            '✅ Все ошибки успешно очищены!',
            {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '🔙 Назад', callback_data: 'errors' }]
                    ]
                }
            }
        );
    } catch (err) {
        console.error('❌ Error in errors_clear_confirm:', err);
        await ctx.answerCbQuery('Ошибка при очистке');
    }
});

// Добавление генераций пользователю
bot.action(/add_quota_(\d+)/, async (ctx) => {
    try {
        const userId = parseInt(ctx.match[1]);
        
        if (!ctx.session) ctx.session = {};
        ctx.session.quotaAction = {
            type: 'add',
            userId: userId
        };
        
        const user = await userService.getUser(userId);
        if (!user) {
            await ctx.answerCbQuery('❌ Пользователь не найден');
            return;
        }
        
        await ctx.editMessageText(
            `➕ Добавление генераций\n\n👤 User ID: ${userId}\n📊 Текущий баланс: ${user.free_quota} бесплатных, ${user.paid_quota} платных\n\n📝 Выберите количество генераций для добавления:`,
            {
                reply_markup: {
                    inline_keyboard: [
                        [
                            { text: '+1', callback_data: `add_quota_confirm_${userId}_1` },
                            { text: '+5', callback_data: `add_quota_confirm_${userId}_5` },
                            { text: '+10', callback_data: `add_quota_confirm_${userId}_10` }
                        ],
                        [
                            { text: '+50', callback_data: `add_quota_confirm_${userId}_50` },
                            { text: '+100', callback_data: `add_quota_confirm_${userId}_100` }
                        ],
                        [{ text: '✏️ Ввести вручную', callback_data: `add_quota_custom_${userId}` }],
                        [{ text: '🔙 Отмена', callback_data: `show_user_${userId}` }]
                    ]
                }
            }
        );
    } catch (err) {
        console.error('❌ Error in add_quota:', err);
        await ctx.answerCbQuery('Ошибка');
    }
});

// Подтверждение добавления генераций
bot.action(/add_quota_confirm_(\d+)_(\d+)/, async (ctx) => {
    try {
        const userId = parseInt(ctx.match[1]);
        const amount = parseInt(ctx.match[2]);
        
        const user = await userService.getUser(userId);
        if (!user) {
            await ctx.answerCbQuery('❌ Пользователь не найден');
            return;
        }
        
        const oldQuota = user.free_quota;
        await userService.addFreeQuota(userId, amount);
        const newQuota = oldQuota + amount;
        
        await ctx.answerCbQuery(`✅ Добавлено ${amount} генераций`);
        
        await ctx.editMessageText(
            `✅ Генерации добавлены!\n\n` +
            `👤 User ID: ${userId}\n` +
            `📊 Было: ${oldQuota}\n` +
            `➕ Добавлено: ${amount}\n` +
            `📊 Стало: ${newQuota}`,
            {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '👤 Посмотреть пользователя', callback_data: `show_user_${userId}` }],
                        [{ text: '🔙 Главное меню', callback_data: 'main_menu' }]
                    ]
                }
            }
        );
        
        // Уведомляем пользователя о добавлении генераций
        try {
            await mainBot.telegram.sendMessage(
                userId,
                `🎁 Вам начислено ${amount} бесплатных генераций!\n\n💎 Ваш новый баланс: ${newQuota} генераций`
            );
        } catch (notifyErr) {
            console.log(`⚠️ Could not notify user ${userId}: ${notifyErr.message}`);
        }
    } catch (err) {
        console.error('❌ Error in add_quota_confirm:', err);
        await ctx.answerCbQuery('Ошибка при добавлении');
    }
});

// Удаление генераций пользователю
bot.action(/remove_quota_(\d+)/, async (ctx) => {
    try {
        const userId = parseInt(ctx.match[1]);
        const user = await userService.getUser(userId);
        
        if (!user) {
            await ctx.answerCbQuery('❌ Пользователь не найден');
            return;
        }
        
        if (!ctx.session) ctx.session = {};
        ctx.session.quotaAction = {
            type: 'remove',
            userId: userId
        };
        
        await ctx.editMessageText(
            `➖ Удаление генераций\n\n` +
            `👤 User ID: ${userId}\n` +
            `📊 Текущий баланс: ${user.free_quota} бесплатных, ${user.paid_quota} платных\n\n` +
            `📝 Выберите количество генераций для удаления:`,
            {
                reply_markup: {
                    inline_keyboard: [
                        [
                            { text: '-1', callback_data: `remove_quota_confirm_${userId}_1` },
                            { text: '-5', callback_data: `remove_quota_confirm_${userId}_5` },
                            { text: '-10', callback_data: `remove_quota_confirm_${userId}_10` }
                        ],
                        [
                            { text: 'Обнулить все', callback_data: `remove_quota_confirm_${userId}_${user.free_quota}` }
                        ],
                        [{ text: '✏️ Ввести вручную', callback_data: `remove_quota_custom_${userId}` }],
                        [{ text: '🔙 Отмена', callback_data: `show_user_${userId}` }]
                    ]
                }
            }
        );
    } catch (err) {
        console.error('❌ Error in remove_quota:', err);
        await ctx.answerCbQuery('Ошибка');
    }
});

// Подтверждение удаления генераций
bot.action(/remove_quota_confirm_(\d+)_(\d+)/, async (ctx) => {
    try {
        const userId = parseInt(ctx.match[1]);
        const amount = parseInt(ctx.match[2]);
        
        const user = await userService.getUser(userId);
        if (!user) {
            await ctx.answerCbQuery('❌ Пользователь не найден');
            return;
        }
        
        const oldQuota = user.free_quota;
        await userService.removeFreeQuota(userId, amount);
        const newQuota = Math.max(0, oldQuota - amount);
        
        await ctx.answerCbQuery(`✅ Удалено ${amount} генераций`);
        
        await ctx.editMessageText(
            `✅ Генерации удалены!\n\n` +
            `👤 User ID: ${userId}\n` +
            `📊 Было: ${oldQuota}\n` +
            `➖ Удалено: ${amount}\n` +
            `📊 Стало: ${newQuota}`,
            {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '👤 Посмотреть пользователя', callback_data: `show_user_${userId}` }],
                        [{ text: '🔙 Главное меню', callback_data: 'main_menu' }]
                    ]
                }
            }
        );
        
        // Уведомляем пользователя об удалении генераций
        try {
            await mainBot.telegram.sendMessage(
                userId,
                `⚠️ С вашего баланса списано ${amount} генераций администратором.\n\n💎 Ваш новый баланс: ${newQuota} генераций`
            );
        } catch (notifyErr) {
            console.log(`⚠️ Could not notify user ${userId}: ${notifyErr.message}`);
        }
    } catch (err) {
        console.error('❌ Error in remove_quota_confirm:', err);
        await ctx.answerCbQuery('Ошибка при удалении');
    }
});

// Пользователи
bot.action('users', async (ctx) => {
    try {
        const totalUsers = await userService.getTotalUsers();
        const allUsers = await userService.getAllUsers();
        
        // Подсчёт активных пользователей (с генерациями)
        const activeUsers = allUsers.filter(u => u.total_generations > 0);
        const paidUsers = allUsers.filter(u => u.paid_quota > 0 || u.total_spent > 0);

        let message = '👥 Статистика пользователей:\n\n';
        message += `├─ Всего: ${totalUsers}\n`;
        message += `├─ Активных: ${activeUsers.length}\n`;
        message += `└─ Платных: ${paidUsers.length}\n\n`;
        
        message += `💡 Для поиска пользователя отправьте его ID`;

        await ctx.editMessageText(message, {
            reply_markup: {
                inline_keyboard: [
                    [{ text: '🔙 Назад', callback_data: 'main_menu' }]
                ]
            }
        });
        
        ctx.session = ctx.session || {};
        ctx.session.waitingForUserId = true;
    } catch (err) {
        console.error('❌ Error in users:', err);
        await ctx.answerCbQuery('Ошибка получения данных');
    }
});

// Показ информации о пользователе
bot.action(/show_user_(\d+)/, async (ctx) => {
    try {
        const userId = parseInt(ctx.match[1]);
        const user = await userService.getUser(userId);
        
        if (!user) {
            await ctx.answerCbQuery('❌ Пользователь не найден');
            return;
        }
        
        let message = `👤 Пользователь ${userId}:\n\n`;
        message += `📝 Имя: ${user.firstName || ''} ${user.lastName || ''}\n`;
        message += `🆔 Username: @${user.username || 'нет'}\n\n`;
        message += `🎬 Генерации:\n`;
        message += `├─ 🎁 Бесплатных: ${user.free_quota || 0}\n`;
        message += `├─ 💎 Платных: ${user.paid_quota || 0}\n`;
        message += `├─ 📊 Всего доступно: ${(user.free_quota || 0) + (user.paid_quota || 0)}\n`;
        message += `├─ ✅ Успешно сделано: ${user.successful_generations || 0}\n`;
        message += `└─ ❌ Ошибок: ${user.failed_generations || 0}\n\n`;
        message += `💰 Потрачено: ${user.total_spent || 0}₽\n`;
        message += `📅 Регистрация: ${new Date(user.createdAt).toLocaleDateString('ru-RU')}`;
        
        await ctx.editMessageText(message, {
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: '➕ Добавить генерации', callback_data: `add_quota_${userId}` },
                        { text: '➖ Убрать генерации', callback_data: `remove_quota_${userId}` }
                    ],
                    [{ text: '🔍 Найти другого', callback_data: 'users' }],
                    [{ text: '🔙 Главное меню', callback_data: 'main_menu' }]
                ]
            }
        });
    } catch (err) {
        console.error('❌ Error in show_user:', err);
        await ctx.answerCbQuery('Ошибка');
    }
});

// Ручной ввод количества для добавления
bot.action(/add_quota_custom_(\d+)/, async (ctx) => {
    try {
        const userId = parseInt(ctx.match[1]);
        
        if (!ctx.session) ctx.session = {};
        ctx.session.quotaAction = {
            type: 'add_custom',
            userId: userId
        };
        
        await ctx.editMessageText(
            `✏️ Ручной ввод\n\n👤 User ID: ${userId}\n\n📝 Отправьте количество генераций для добавления (число):`,
            {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '🔙 Отмена', callback_data: `show_user_${userId}` }]
                    ]
                }
            }
        );
    } catch (err) {
        console.error('❌ Error in add_quota_custom:', err);
        await ctx.answerCbQuery('Ошибка');
    }
});

// Ручной ввод количества для удаления
bot.action(/remove_quota_custom_(\d+)/, async (ctx) => {
    try {
        const userId = parseInt(ctx.match[1]);
        
        if (!ctx.session) ctx.session = {};
        ctx.session.quotaAction = {
            type: 'remove_custom',
            userId: userId
        };
        
        await ctx.editMessageText(
            `✏️ Ручной ввод\n\n👤 User ID: ${userId}\n\n📝 Отправьте количество генераций для удаления (число):`,
            {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '🔙 Отмена', callback_data: `show_user_${userId}` }]
                    ]
                }
            }
        );
    } catch (err) {
        console.error('❌ Error in remove_quota_custom:', err);
        await ctx.answerCbQuery('Ошибка');
    }
});

// Рассылка
bot.action('broadcast', async (ctx) => {
    try {
        if (!ctx.session) ctx.session = {};
        
        // Очищаем предыдущие данные и флаги
        ctx.session.broadcast = { step: 'content' };
        delete ctx.session.waitingFor;
        delete ctx.session.waitingForUserId;
        delete ctx.session.quotaAction;
        
        await ctx.editMessageText(
            '📢 Рассылка сообщений\n\n' +
            '📝 Шаг 1: Отправьте содержание\n\n' +
            '▫️ Текст — просто напишите сообщение\n' +
            '▫️ Фото/Видео — отправьте медиа (с подписью или без)\n\n' +
            '💡 HTML: <b>жирный</b>, <i>курсив</i>',
            {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '🔙 Отмена', callback_data: 'main_menu' }]
                    ]
                }
            }
        );
    } catch (err) {
        console.error('❌ Error in broadcast:', err);
        await ctx.answerCbQuery('Ошибка');
    }
});

// Экспорт отчётов
bot.action('export_reports', async (ctx) => {
    try {
        await ctx.editMessageText(
            '📥 Экспорт отчётов\n\nВыберите тип отчёта:',
            {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '👥 Пользователи', callback_data: 'export_users' }],
                        [{ text: '💳 Платежи', callback_data: 'export_payments' }],
                        [{ text: '🎬 Генерации', callback_data: 'export_generations' }],
                        [{ text: '🔙 Назад', callback_data: 'main_menu' }]
                    ]
                }
            }
        );
    } catch (err) {
        console.error('❌ Error in export_reports:', err);
        await ctx.answerCbQuery('Ошибка');
    }
});

// Экспорт пользователей
bot.action('export_users', async (ctx) => {
    try {
        await ctx.answerCbQuery('Подготовка отчёта...');
        const allUsers = await userService.getAllUsers();
        
        let csvData = 'User ID,Username,First Name,Free Quota,Paid Quota,Total Spent,Successful Generations,Failed Generations,Created At\n';
        
        for (const user of allUsers) {
            csvData += `${user.userId},`;
            csvData += `${user.username || ''},`;
            csvData += `${user.firstName || ''},`;
            csvData += `${user.free_quota || 0},`;
            csvData += `${user.paid_quota || 0},`;
            csvData += `${user.total_spent || 0},`;
            csvData += `${user.successful_generations || 0},`;
            csvData += `${user.failed_generations || 0},`;
            csvData += `${user.createdAt || ''}\n`;
        }
        
        // Отправляем как документ
        await ctx.replyWithDocument(
            {
                source: Buffer.from(csvData, 'utf-8'),
                filename: `users_export_${new Date().toISOString().split('T')[0]}.csv`
            },
            { caption: `📊 Отчёт по пользователям\nВсего: ${allUsers.length}` }
        );
        
        await ctx.reply('✅ Отчёт готов!', ADMIN_MENU);
    } catch (err) {
        console.error('❌ Error exporting users:', err);
        await ctx.reply('❌ Ошибка при экспорте');
    }
});

// Экспорт платежей
bot.action('export_payments', async (ctx) => {
    try {
        await ctx.answerCbQuery('Подготовка отчёта...');
        const allOrders = await orderService.getAllOrders();
        
        let csvData = 'Order ID,User ID,Amount,Package,Method,Status,Paid,Created At\n';
        
        for (const order of allOrders) {
            csvData += `${order.orderId},`;
            csvData += `${order.userId},`;
            csvData += `${order.amount || 0},`;
            csvData += `${order.package || ''},`;
            csvData += `${order.isFiat ? 'Card' : 'Crypto'},`;
            csvData += `${order.status || ''},`;
            csvData += `${order.isPaid ? 'Yes' : 'No'},`;
            csvData += `${order.createdAt || ''}\n`;
        }
        
        await ctx.replyWithDocument(
            {
                source: Buffer.from(csvData, 'utf-8'),
                filename: `payments_export_${new Date().toISOString().split('T')[0]}.csv`
            },
            { caption: `💳 Отчёт по платежам\nВсего: ${allOrders.length}` }
        );
        
        await ctx.reply('✅ Отчёт готов!', ADMIN_MENU);
    } catch (err) {
        console.error('❌ Error exporting payments:', err);
        await ctx.reply('❌ Ошибка при экспорте');
    }
});

// Экспорт генераций
bot.action('export_generations', async (ctx) => {
    try {
        await ctx.answerCbQuery('Подготовка отчёта...');
        
        // Получаем все генерации из Redis
        const redisModule = await import('./redis.js');
        const redisClient = redisModule.default;
        const allKeys = await redisClient.keys('generation:*');
        const generations = [];
        
        for (const key of allKeys) {
            const gen = await redisClient.get(key);
            if (gen) {
                generations.push(JSON.parse(gen));
            }
        }
        
        let csvData = 'Generation ID,User ID,Meme ID,Meme Name,Name,Gender,Status,Created At,Updated At\n';
        
        for (const gen of generations) {
            csvData += `${gen.generationId},`;
            csvData += `${gen.userId},`;
            csvData += `${gen.memeId},`;
            csvData += `${gen.memeName || ''},`;
            csvData += `${gen.name || ''},`;
            csvData += `${gen.gender || ''},`;
            csvData += `${gen.status || ''},`;
            csvData += `${gen.createdAt || ''},`;
            csvData += `${gen.updatedAt || ''}\n`;
        }
        
        await ctx.replyWithDocument(
            {
                source: Buffer.from(csvData, 'utf-8'),
                filename: `generations_export_${new Date().toISOString().split('T')[0]}.csv`
            },
            { caption: `🎬 Отчёт по генерациям\nВсего: ${generations.length}` }
        );
        
        await ctx.reply('✅ Отчёт готов!', ADMIN_MENU);
    } catch (err) {
        console.error('❌ Error exporting generations:', err);
        console.error('Error details:', err.stack);
        await ctx.reply('❌ Ошибка при экспорте: ' + err.message);
    }
});

// Обработка текстовых сообщений
bot.on('text', async (ctx) => {
    try {
        if (!ctx.session) ctx.session = {};
        
        // Рассылка - шаг 1: получение текста (ПРИОРИТЕТ!)
        if (ctx.session.broadcast && ctx.session.broadcast.step === 'content') {
            ctx.session.broadcast.text = ctx.message.text;
            ctx.session.broadcast.step = 'button_choice';
            
            await ctx.reply(
                '📢 Шаг 2: Добавить кнопку?',
                {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '✅ Да', callback_data: 'broadcast_add_button' }],
                            [{ text: '⏭️ Нет', callback_data: 'broadcast_skip_button' }],
                            [{ text: '🔙 Отмена', callback_data: 'main_menu' }]
                        ]
                    }
                }
            );
            return;
        }
        
        // Рассылка - текст кнопки
        if (ctx.session.broadcast && ctx.session.broadcast.step === 'button_text') {
            ctx.session.broadcast.buttonText = ctx.message.text;
            ctx.session.broadcast.step = 'button_url';
            
            await ctx.reply(
                '📢 Шаг 3: Отправьте URL для кнопки\n\nПример: https://t.me/your_channel',
                {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '🔙 Отмена', callback_data: 'main_menu' }]
                        ]
                    }
                }
            );
            return;
        }
        
        // Удаление эксперта (ПРИОРИТЕТ перед поиском пользователя!)
        if (ctx.session.waitingFor === 'expert_remove_id') {
            const userId = parseInt(ctx.message.text);
            
            if (isNaN(userId)) {
                return await ctx.reply('❌ Неверный формат ID. Введите число.');
            }
            
            const result = await referralService.removeExpert(userId);
            
            if (result.success) {
                await ctx.reply(`✅ Пользователь ${userId} удален из экспертов!`);
            } else {
                await ctx.reply(`❌ Ошибка: ${result.error}`);
            }
            
            delete ctx.session.waitingFor;
            
            // Показываем обновленный список
            setTimeout(async () => {
                const experts = await referralService.getAllExperts();
                let message = '💼 Управление экспертами\n\n';
                message += `Всего экспертов: ${experts.length}\n\n`;
                
                await ctx.reply(message, {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '➕ Добавить эксперта', callback_data: 'expert_add' }],
                            [{ text: '➖ Удалить эксперта', callback_data: 'expert_remove' }],
                            [{ text: '🔙 Назад', callback_data: 'main_menu' }]
                        ]
                    }
                });
            }, 500);
            
            return;
        }
        
        // Поиск пользователя
        if (ctx.session.waitingForUserId) {
            const userId = parseInt(ctx.message.text);
            if (isNaN(userId)) {
                return await ctx.reply('❌ Некорректный ID. Отправьте число.');
            }
            
            const user = await userService.getUser(userId);
            if (!user) {
                return await ctx.reply('❌ Пользователь не найден');
            }
            
            let message = `👤 Пользователь ${userId}:\n\n`;
            message += `📝 Имя: ${user.firstName || ''} ${user.lastName || ''}\n`;
            message += `🆔 Username: @${user.username || 'нет'}\n\n`;
            message += `🎬 Генерации:\n`;
            message += `├─ 🎁 Бесплатных: ${user.free_quota || 0}\n`;
            message += `├─ 💎 Платных: ${user.paid_quota || 0}\n`;
            message += `├─ 📊 Всего доступно: ${(user.free_quota || 0) + (user.paid_quota || 0)}\n`;
            message += `├─ ✅ Успешно сделано: ${user.successful_generations || 0}\n`;
            message += `└─ ❌ Ошибок: ${user.failed_generations || 0}\n\n`;
            message += `💰 Потрачено: ${user.total_spent || 0}₽\n`;
            message += `📅 Регистрация: ${new Date(user.createdAt).toLocaleDateString('ru-RU')}`;
            
            await ctx.reply(message, {
                reply_markup: {
                    inline_keyboard: [
                        [
                            { text: '➕ Добавить генерации', callback_data: `add_quota_${userId}` },
                            { text: '➖ Убрать генерации', callback_data: `remove_quota_${userId}` }
                        ],
                        [{ text: '🔍 Найти другого', callback_data: 'users' }],
                        [{ text: '🔙 Главное меню', callback_data: 'main_menu' }]
                    ]
                }
            });
            delete ctx.session.waitingForUserId;
            return;
        }
        
        // Ручное добавление генераций
        if (ctx.session.quotaAction && ctx.session.quotaAction.type === 'add_custom') {
            const amount = parseInt(ctx.message.text);
            if (isNaN(amount) || amount <= 0) {
                return await ctx.reply('❌ Некорректное количество. Отправьте положительное число.');
            }
            
            const userId = ctx.session.quotaAction.userId;
            const user = await userService.getUser(userId);
            
            if (!user) {
                return await ctx.reply('❌ Пользователь не найден');
            }
            
            const oldQuota = user.free_quota;
            await userService.addFreeQuota(userId, amount);
            const newQuota = oldQuota + amount;
            
            await ctx.reply(
                `✅ Генерации добавлены!\n\n` +
                `👤 User ID: ${userId}\n` +
                `📊 Было: ${oldQuota}\n` +
                `➕ Добавлено: ${amount}\n` +
                `📊 Стало: ${newQuota}`,
                {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '👤 Посмотреть пользователя', callback_data: `show_user_${userId}` }],
                            [{ text: '🔙 Главное меню', callback_data: 'main_menu' }]
                        ]
                    }
                }
            );
            
            // Уведомляем пользователя
            try {
                await mainBot.telegram.sendMessage(
                    userId,
                    `🎁 Вам начислено ${amount} бесплатных генераций!\n\n💎 Ваш новый баланс: ${newQuota} генераций`
                );
            } catch (notifyErr) {
                console.log(`⚠️ Could not notify user ${userId}: ${notifyErr.message}`);
            }
            
            delete ctx.session.quotaAction;
            return;
        }
        
        // Ручное удаление генераций
        if (ctx.session.quotaAction && ctx.session.quotaAction.type === 'remove_custom') {
            const amount = parseInt(ctx.message.text);
            if (isNaN(amount) || amount <= 0) {
                return await ctx.reply('❌ Некорректное количество. Отправьте положительное число.');
            }
            
            const userId = ctx.session.quotaAction.userId;
            const user = await userService.getUser(userId);
            
            if (!user) {
                return await ctx.reply('❌ Пользователь не найден');
            }
            
            const oldQuota = user.free_quota;
            await userService.removeFreeQuota(userId, amount);
            const newQuota = Math.max(0, oldQuota - amount);
            
            await ctx.reply(
                `✅ Генерации удалены!\n\n` +
                `👤 User ID: ${userId}\n` +
                `📊 Было: ${oldQuota}\n` +
                `➖ Удалено: ${amount}\n` +
                `📊 Стало: ${newQuota}`,
                {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '👤 Посмотреть пользователя', callback_data: `show_user_${userId}` }],
                            [{ text: '🔙 Главное меню', callback_data: 'main_menu' }]
                        ]
                    }
                }
            );
            
            // Уведомляем пользователя
            try {
                await mainBot.telegram.sendMessage(
                    userId,
                    `⚠️ С вашего баланса списано ${amount} генераций администратором.\n\n💎 Ваш новый баланс: ${newQuota} генераций`
                );
            } catch (notifyErr) {
                console.log(`⚠️ Could not notify user ${userId}: ${notifyErr.message}`);
            }
            
            delete ctx.session.quotaAction;
            return;
        }
        
        // Добавление эксперта
        if (ctx.session.waitingFor === 'expert_add_id') {
            const userId = parseInt(ctx.message.text);
            
            if (isNaN(userId)) {
                return await ctx.reply('❌ Неверный формат ID. Введите число.');
            }
            
            const result = await referralService.addExpert(userId);
            
            if (result.success) {
                await ctx.reply(`✅ Пользователь ${userId} добавлен в эксперты!`);
            } else {
                await ctx.reply(`❌ Ошибка: ${result.error}`);
            }
            
            delete ctx.session.waitingFor;
            
            // Показываем обновленный список
            setTimeout(async () => {
                const experts = await referralService.getAllExperts();
                let message = '💼 Управление экспертами\n\n';
                message += `Всего экспертов: ${experts.length}\n\n`;
                
                await ctx.reply(message, {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '➕ Добавить эксперта', callback_data: 'expert_add' }],
                            [{ text: '➖ Удалить эксперта', callback_data: 'expert_remove' }],
                            [{ text: '🔙 Назад', callback_data: 'main_menu' }]
                        ]
                    }
                });
            }, 500);
            
            return;
        }
        
        // Рассылка - URL кнопки
        if (ctx.session.broadcast && ctx.session.broadcast.step === 'button_url') {
            const url = ctx.message.text;
            
            try {
                new URL(url);
                ctx.session.broadcast.buttonUrl = url;
                await showBroadcastPreview(ctx);
            } catch (err) {
                await ctx.reply('❌ Некорректный URL. Попробуйте ещё раз.');
            }
            return;
        }
        
    } catch (err) {
        console.error('❌ Error in text handler:', err);
        await ctx.reply('Произошла ошибка');
    }
});

// Обработка фото
bot.on('photo', async (ctx) => {
    try {
        if (!ctx.session) ctx.session = {};
        
        if (ctx.session.broadcast && ctx.session.broadcast.step === 'content') {
            // Берём лучшее качество фото
            const photo = ctx.message.photo[ctx.message.photo.length - 1];
            const caption = ctx.message.caption || '';
            
            console.log(`📸 Photo received: file_id=${photo.file_id}, caption="${caption}"`);
            
            try {
                // Скачиваем фото через админ-бота
                console.log('⬇️ Downloading photo...');
                const fileLink = await ctx.telegram.getFileLink(photo.file_id);
                const response = await axios.get(fileLink.href, { responseType: 'arraybuffer' });
                const photoBuffer = Buffer.from(response.data);
                
                console.log(`✅ Photo downloaded: ${photoBuffer.length} bytes`);
                
                // Сохраняем Buffer напрямую (не base64!)
                ctx.session.broadcast.photoBuffer = photoBuffer;
                ctx.session.broadcast.text = caption;
                ctx.session.broadcast.step = 'button_choice';
                
                await ctx.reply(
                    '📢 Шаг 2: Добавить кнопку?',
                    {
                        reply_markup: {
                            inline_keyboard: [
                                [{ text: '✅ Да', callback_data: 'broadcast_add_button' }],
                                [{ text: '⏭️ Нет', callback_data: 'broadcast_skip_button' }],
                                [{ text: '🔙 Отмена', callback_data: 'main_menu' }]
                            ]
                        }
                    }
                );
            } catch (err) {
                console.error('❌ Error downloading photo:', err);
                await ctx.reply('❌ Ошибка при обработке фото. Попробуйте ещё раз.');
            }
        }
    } catch (err) {
        console.error('❌ Error in photo handler:', err);
        await ctx.reply('Произошла ошибка при обработке фото');
    }
});

// Callback для добавления кнопки
bot.action('broadcast_add_button', async (ctx) => {
    try {
        ctx.session.broadcast.step = 'button_text';
        
        await ctx.editMessageText(
            '📢 Шаг 2: Текст кнопки\n\nОтправьте текст для кнопки\n\nПример: Перейти в канал',
            {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '🔙 Отмена', callback_data: 'main_menu' }]
                    ]
                }
            }
        );
    } catch (err) {
        console.error('❌ Error:', err);
    }
});

// Callback для пропуска кнопки
bot.action('broadcast_skip_button', async (ctx) => {
    try {
        await showBroadcastPreview(ctx);
    } catch (err) {
        console.error('❌ Error:', err);
    }
});

// Показ превью и подтверждение рассылки
async function showBroadcastPreview(ctx) {
    try {
        const allUsers = await userService.getAllUsers();
        const broadcast = ctx.session.broadcast;
        
        let message = '📢 Предпросмотр рассылки\n\n';
        message += `👥 Получателей: ${allUsers.length}\n\n`;
        message += '───────────────\n';
        message += broadcast.text || '(медиа без подписи)';
        message += '\n───────────────\n\n';
        
        if (broadcast.photoBuffer) {
            message += '📷 С фото: ДА\n';
        }
        
        if (broadcast.videoBuffer) {
            message += '🎬 С видео: ДА\n';
        }
        
        if (broadcast.buttonText) {
            message += `🔘 Кнопка: "${broadcast.buttonText}"\n`;
            message += `🔗 URL: ${broadcast.buttonUrl}\n`;
        }
        
        message += '\n⚠️ Отправить рассылку?';
        
        await ctx.reply(message, {
            reply_markup: {
                inline_keyboard: [
                    [{ text: '✅ Да, отправить', callback_data: 'broadcast_confirm' }],
                    [{ text: '🔙 Отмена', callback_data: 'main_menu' }]
                ]
            }
        });
    } catch (err) {
        console.error('❌ Error in preview:', err);
        await ctx.reply('Произошла ошибка');
    }
}

// Подтверждение и отправка рассылки
bot.action('broadcast_confirm', async (ctx) => {
    try {
        if (!ctx.session || !ctx.session.broadcast) {
            await ctx.answerCbQuery('❌ Ошибка: данные рассылки не найдены', { show_alert: true });
            return;
        }

        const allUsers = await userService.getAllUsers();
        const broadcast = ctx.session.broadcast;
        const { text, photoBuffer, videoBuffer, buttonText, buttonUrl } = broadcast;
        
        console.log('\n📤 Starting broadcast...');
        console.log(`  Recipients: ${allUsers.length}`);
        console.log(`  Has photo: ${!!photoBuffer}`);
        console.log(`  Has video: ${!!videoBuffer}`);
        console.log(`  Has text: ${!!text}`);
        console.log(`  Has button: ${!!buttonText}`);
        
        if (allUsers.length === 0) {
            await ctx.editMessageText('❌ Нет пользователей для рассылки!', ADMIN_MENU);
            return;
        }
        
        await ctx.editMessageText(`📤 Начинаю рассылку ${allUsers.length} пользователям...`);
        
        let success = 0;
        let failed = 0;
        const failedUsers = []; // Список пользователей с ошибками
        
        // Подготавливаем опции для медиа (фото/видео)
        const mediaOptions = {};
        if (text) {
            mediaOptions.caption = text;
            mediaOptions.parse_mode = 'HTML';
        }
        if (buttonText && buttonUrl) {
            mediaOptions.reply_markup = {
                inline_keyboard: [[{ text: buttonText, url: buttonUrl }]]
            };
        }
        
        // Опции для текста
        const textOptions = { parse_mode: 'HTML' };
        if (buttonText && buttonUrl) {
            textOptions.reply_markup = {
                inline_keyboard: [[{ text: buttonText, url: buttonUrl }]]
            };
        }
        
        // Рассылка
        for (const user of allUsers) {
            try {
                if (!user.userId) {
                    failed++;
                    failedUsers.push({ userId: 'unknown', username: user.username, reason: 'No user ID' });
                    continue;
                }
                
                if (videoBuffer) {
                    // Отправка с видео используя Buffer
                    await mainBot.telegram.sendVideo(
                        user.userId, 
                        { source: videoBuffer },
                        mediaOptions
                    );
                } else if (photoBuffer) {
                    // Отправка с фото используя Buffer
                    await mainBot.telegram.sendPhoto(
                        user.userId, 
                        { source: photoBuffer },
                        mediaOptions
                    );
                } else if (text) {
                    // Только текст
                    await mainBot.telegram.sendMessage(user.userId, text, textOptions);
                } else {
                    console.log(`⚠️ Skip user ${user.userId}: no content`);
                    failed++;
                    failedUsers.push({ userId: user.userId, username: user.username, reason: 'No content' });
                    continue;
                }
                
                success++;
                console.log(`✅ Sent to ${user.userId} (@${user.username || 'unknown'})`);
                
                // Задержка 50мс между сообщениями
                await new Promise(resolve => setTimeout(resolve, 50));
                
            } catch (err) {
                failed++;
                const reason = err.message.includes('bot was blocked') ? 'Bot blocked' :
                              err.message.includes('user is deactivated') ? 'User deactivated' :
                              err.message.includes('chat not found') ? 'Chat not found' :
                              err.message;
                
                failedUsers.push({ 
                    userId: user.userId, 
                    username: user.username, 
                    reason: reason 
                });
                
                console.error(`❌ Failed to send to ${user.userId} (@${user.username || 'unknown'}): ${reason}`);
            }
        }
        
        console.log(`\n✅ Broadcast complete: ${success} sent, ${failed} failed`);
        
        // Выводим детальный отчет об ошибках
        if (failedUsers.length > 0) {
            console.log('\n📋 Failed users:');
            failedUsers.forEach(u => {
                console.log(`  ❌ ${u.userId} (@${u.username || 'unknown'}): ${u.reason}`);
            });
        }
        console.log('');
        
        await ctx.reply(
            `✅ Рассылка завершена!\n\n✔️ Отправлено: ${success}\n❌ Ошибок: ${failed}`,
            ADMIN_MENU
        );
        
        // Очищаем сессию
        delete ctx.session.broadcast;
        
    } catch (err) {
        console.error('❌ Error in broadcast confirm:', err);
        await ctx.reply('❌ Ошибка при рассылке: ' + err.message);
    }
});

// ============================================
// УПРАВЛЕНИЕ ЭКСПЕРТАМИ
// ============================================

// Список экспертов
bot.action('experts', async (ctx) => {
    try {
        await ctx.answerCbQuery();
        
        const experts = await referralService.getAllExperts();
        
        let message = '💼 Управление экспертами\n\n';
        
        if (experts.length === 0) {
            message += 'Экспертов пока нет.\n\n';
        } else {
            message += `Всего экспертов: ${experts.length}\n\n`;
            experts.forEach((expert, index) => {
                message += `${index + 1}. ID: ${expert.userId}\n`;
                message += `   👤 ${expert.firstName || 'N/A'} (@${expert.username || 'N/A'})\n`;
                message += `   👥 Рефералов: ${expert.expertReferrals}\n`;
                message += `   💰 Заработано: ${expert.totalCashback?.toFixed(2) || 0}₽\n\n`;
            });
        }
        
        await ctx.editMessageText(message, {
            reply_markup: {
                inline_keyboard: [
                    [{ text: '➕ Добавить эксперта', callback_data: 'expert_add' }],
                    [{ text: '➖ Удалить эксперта', callback_data: 'expert_remove' }],
                    [{ text: '🔙 Назад', callback_data: 'main_menu' }]
                ]
            }
        });
    } catch (err) {
        console.error('❌ Error in experts:', err);
        await ctx.answerCbQuery('Ошибка');
    }
});

// Добавить эксперта
bot.action('expert_add', async (ctx) => {
    try {
        await ctx.answerCbQuery();
        
        ctx.session = ctx.session || {};
        ctx.session.waitingFor = 'expert_add_id';
        
        await ctx.editMessageText(
            '➕ Добавление эксперта\n\n' +
            'Отправьте Telegram ID пользователя, которого хотите сделать экспертом.\n\n' +
            'Пример: 123456789',
            {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '🔙 Отмена', callback_data: 'experts' }]
                    ]
                }
            }
        );
    } catch (err) {
        console.error('❌ Error in expert_add:', err);
        await ctx.answerCbQuery('Ошибка');
    }
});

// Удалить эксперта
bot.action('expert_remove', async (ctx) => {
    try {
        await ctx.answerCbQuery();
        
        ctx.session = ctx.session || {};
        ctx.session.waitingFor = 'expert_remove_id';
        
        await ctx.editMessageText(
            '➖ Удаление эксперта\n\n' +
            'Отправьте Telegram ID эксперта, которого хотите удалить.\n\n' +
            'Пример: 123456789',
            {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '🔙 Отмена', callback_data: 'experts' }]
                    ]
                }
            }
        );
    } catch (err) {
        console.error('❌ Error in expert_remove:', err);
        await ctx.answerCbQuery('Ошибка');
    }
});
// УДАЛЕНО - дублирующий обработчик, логика перенесена в основной обработчик текста выше

// Обработка неизвестных callback (для отладки)
bot.on('callback_query', async (ctx) => {
    const callbackData = ctx.callbackQuery.data;
    console.log('⚠️ Unhandled admin callback:', callbackData);
    await ctx.answerCbQuery('Функция в разработке');
});

// Обработка ошибок
bot.catch((err, ctx) => {
    console.error('❌ Admin bot error:', err);
    if (ctx) {
        ctx.reply('Произошла ошибка. Попробуйте позже.')
            .catch(e => console.error('Failed to send error message:', e));
    }
});

// Запуск бота
async function startBot() {
    try {
        // Сбрасываем webhook перед запуском (решает проблему 409 конфликта)
        console.log('🔄 Deleting webhook...');
        await bot.telegram.deleteWebhook({ drop_pending_updates: true });
        console.log('✅ Webhook deleted');
        
        // Запускаем бота
        await bot.launch();
        console.log('✅ MeeMee Admin bot started successfully!');
        console.log(`Bot username: @${bot.botInfo.username}`);
    } catch (err) {
        console.error('❌ Failed to start admin bot:', err);
        process.exit(1);
    }
}

startBot();

// Graceful shutdown
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
