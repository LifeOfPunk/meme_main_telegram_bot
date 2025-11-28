import 'dotenv/config';
import { Telegraf, Scenes, session, Markup } from 'telegraf';
import { UserService } from './services/User.service.js';
import { OrderService } from './services/Order.service.js';
import { PaymentCryptoService } from './services/PaymentCrypto.service.js';
import { PaymentFiatService } from './services/PaymentFiat.service.js';
import { GenerationService } from './services/Generation.service.js';
import { ReferralService } from './services/Referral.service.js';
import { SubscriptionService } from './services/Subscription.service.js';
import { errorLogger } from './services/ErrorLogger.service.js';
import { MESSAGES, PACKAGES, SUPPORTED_CRYPTO, REFERRAL_ENABLED, REFERRAL_BONUS, EXPERT_CASHBACK_PERCENT, BACK_TO_MENU, GENDER_CHOICE, CONFIRM_GENERATION } from './config.js';
import { 
    createCatalogKeyboard, 
    createCryptoKeyboard, 
    createChainKeyboard,
    createPaymentCryptoKeyboard,
    createAfterPaymentKeyboard,
    createMainMenuKeyboard
} from './screens/keyboards.js';
import { getMemeById } from './utils/memeLoader.js';

// Проверка токена бота
if (!process.env.BOT_TOKEN) {
    console.error('❌ BOT_TOKEN not found in .env file');
    process.exit(1);
}

const bot = new Telegraf(process.env.BOT_TOKEN);
const userService = new UserService();
const orderService = new OrderService();
const paymentCryptoService = new PaymentCryptoService();
const paymentFiatService = new PaymentFiatService();
const generationService = new GenerationService(bot); // Передаем bot instance
const referralService = new ReferralService();
const subscriptionService = new SubscriptionService(bot);

// Устанавливаем команды меню (кнопка слева от поля ввода)
bot.telegram.setMyCommands([
    { command: 'start', description: 'Главное меню' },
    { command: 'create', description: 'Создать мем' }
]).then(() => {
    console.log('✅ Bot menu commands set');
}).catch(err => {
    console.error('❌ Error setting menu commands:', err);
});

// Показать гайд по промптам из каталога/кнопки
bot.action('prompt_guide', async (ctx) => {
    try {
        await safeAnswerCbQuery(ctx);
        await ctx.reply(MESSAGES.PROMPT_GUIDE, { reply_markup: BACK_TO_MENU });
    } catch (err) {
        console.error('❌ Error in prompt_guide:', err);
        await safeAnswerCbQuery(ctx, 'Произошла ошибка');
    }
});

// Показать полный гайд из ветки создания по своему описанию
bot.action('show_full_guide', async (ctx) => {
    try {
        await safeAnswerCbQuery(ctx);
        await ctx.editMessageText(
            MESSAGES.PROMPT_GUIDE,
            {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '⏪ Вернуться назад', callback_data: 'custom_prompt' }]
                    ]
                }
            }
        );
    } catch (err) {
        console.error('❌ Error in show_full_guide:', err);
        await safeAnswerCbQuery(ctx, 'Произошла ошибка');
    }
});

// Session middleware
bot.use(session());

// Helper функция для безопасного answerCbQuery
async function safeAnswerCbQuery(ctx, text = undefined, options = {}) {
    try {
        await ctx.answerCbQuery(text, options);
    } catch (err) {
        // Игнорируем ошибки timeout и invalid query ID
        if (err.message.includes('query is too old') || err.message.includes('query ID is invalid')) {
            console.log('⚠️ Callback query expired, ignoring');
        } else {
            console.error('❌ Error in answerCbQuery:', err.message);
        }
    }
}

// Вайтлист убран - бот доступен всем пользователям

// Middleware для обновления username
bot.use(async (ctx, next) => {
    try {
        const userId = ctx.from?.id;
        if (userId) {
            const user = await userService.getUser(userId);
            if (user) {
                const currentUsername = ctx.from.username || null;
                const currentFirstName = ctx.from.first_name || user.firstName;
                const currentLastName = ctx.from.last_name || user.lastName;
                
                // Обновляем только если что-то изменилось
                if (user.username !== currentUsername || 
                    user.firstName !== currentFirstName || 
                    user.lastName !== currentLastName) {
                    await userService.updateUser(userId, {
                        username: currentUsername,
                        firstName: currentFirstName,
                        lastName: currentLastName
                    });
                    console.log(`🔄 Updated user info for ${userId}: @${currentUsername || 'N/A'}`);
                }
            }
        }
    } catch (err) {
        console.error('⚠️ Error updating user info:', err.message);
    }
    await next();
});

// Middleware для логирования
bot.use(async (ctx, next) => {
    const start = Date.now();
    await next();
    const ms = Date.now() - start;
    console.log(`⏱️ Response time: ${ms}ms`);
});

// Обработка команды /start
bot.start(async (ctx) => {
    try {
        const userId = ctx.from.id;
        const startPayload = ctx.startPayload;
        
        // Определяем UTM источник из deep link
        let utmSource = null;
        const deepLink = ctx.message?.text || '';
        if (deepLink.includes('/tiktok')) {
            utmSource = 'tiktok';
        } else if (deepLink.includes('/ig')) {
            utmSource = 'instagram';
        } else if (deepLink.includes('/yt')) {
            utmSource = 'youtube';
        }

        // Создание пользователя (перед обработкой реферала)
        const existingUser = await userService.getUser(userId);
        await userService.createUser(ctx.from, startPayload, utmSource);
        const isNewUser = !existingUser;
        
        // Логируем источник для новых пользователей
        if (isNewUser && utmSource) {
            console.log(`📊 New user ${userId} from source: ${utmSource}`);
        }

        let showWelcome = true;

        // Обработка реферальных ссылок (только для новых пользователей)
        if (startPayload && isNewUser) {
            if (startPayload.startsWith('ref_')) {
                const referrerId = parseInt(startPayload.replace('ref_', ''));
                const success = await referralService.processReferral(referrerId, userId);
                
                if (success) {
                    // Уведомляем нового пользователя о бонусе
                    await ctx.reply(
                        `🎉 Добро пожаловать!\n\nВы получили +${REFERRAL_BONUS} бесплатную генерацию за переход по реферальной ссылке!`
                    );
                    showWelcome = false;
                    
                    // Уведомляем реферера
                    try {
                        await bot.telegram.sendMessage(
                            referrerId,
                            `🎉 По вашей ссылке зарегистрировался новый пользователь!\n\n+${REFERRAL_BONUS} бесплатная генерация добавлена на ваш баланс!`
                        );
                    } catch (notifyErr) {
                        console.log(`Failed to notify referrer ${referrerId}:`, notifyErr.message);
                    }
                }
            } else if (startPayload.startsWith('expert_')) {
                const expertId = parseInt(startPayload.replace('expert_', ''));
                const success = await referralService.processExpertReferral(expertId, userId);
                
                if (success) {
                    // Уведомляем эксперта
                    try {
                        await bot.telegram.sendMessage(
                            expertId,
                            `💼 По вашей экспертной ссылке зарегистрировался новый пользователь!\n\n💰 Вы будете получать ${EXPERT_CASHBACK_PERCENT}% с каждой его оплаты!`
                        );
                    } catch (notifyErr) {
                        console.log(`Failed to notify expert ${expertId}:`, notifyErr.message);
                    }
                }
            }
        }

        // Отправка приветственного сообщения
        if (showWelcome && isNewUser) {
            // Для новых пользователей отправляем приветственное изображение
            try {
                await ctx.replyWithPhoto(
                    { source: './media/start.png' },
                    {
                        caption: MESSAGES.WELCOME,
                        parse_mode: 'Markdown',
                        reply_markup: {
                            keyboard: [
                                [{ text: 'START' }]
                            ],
                            resize_keyboard: true,
                            one_time_keyboard: true
                        }
                    }
                );
            } catch (photoErr) {
                console.log('⚠️ Failed to send welcome photo, sending text instead');
                await ctx.reply(MESSAGES.WELCOME, { 
                    parse_mode: 'Markdown',
                    reply_markup: {
                        keyboard: [
                            [{ text: 'START' }]
                        ],
                        resize_keyboard: true,
                        one_time_keyboard: true
                    }
                });
            }
        } else {
            // Для существующих пользователей всегда показываем главное меню
            const mainMenu = await createMainMenuKeyboard(userId);
            await ctx.reply(MESSAGES.MAIN_MENU, { 
                reply_markup: mainMenu
            });
        }
    } catch (err) {
        console.error('❌ Error in /start:', err);
        
        // Логируем ошибку
        const errorData = await errorLogger.logError({
            message: err.message,
            stack: err.stack,
            name: err.name || 'StartCommandError',
            source: 'Bot Start Command'
        });
        
        if (ctx && ctx.reply) {
            try {
                await ctx.reply(`❌ Произошла ошибка номер ${errorData.id}. Обратитесь к менеджеру @aiviral_manager с номером ошибки.`);
            } catch (replyErr) {
                console.error("❌ Failed to send error message:", replyErr.message);
            }
        }
    }
});

// Обработка команды /create (Создать видео)
bot.command('create', async (ctx) => {
    try {
        await ctx.reply(
            MESSAGES.CREATE_VIDEO_MENU,
            {
                parse_mode: 'Markdown',
                disable_web_page_preview: true,
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '✍️ Написать свой промпт', callback_data: 'custom_prompt' }],
                        [{ text: '📝 Использовать шаблон', callback_data: 'catalog' }],
                        [{ text: '⏪ Вернуться назад', callback_data: 'main_menu' }]
                    ]
                }
            }
        );
    } catch (err) {
        console.error('❌ Error in /create:', err);
        await ctx.reply('Произошла ошибка. Попробуйте позже.');
    }
});

// Обработка главного меню
bot.action('main_menu', async (ctx) => {
    try {
        await safeAnswerCbQuery(ctx); // Убираем индикатор загрузки
        const userId = ctx.from.id;
        const mainMenu = await createMainMenuKeyboard(userId);
        await ctx.editMessageText(MESSAGES.MAIN_MENU, { reply_markup: mainMenu });
    } catch (err) {
        await safeAnswerCbQuery(ctx);
        const userId = ctx.from.id;
        const mainMenu = await createMainMenuKeyboard(userId);
        await ctx.reply(MESSAGES.MAIN_MENU, { reply_markup: mainMenu });
    }
});

// Проверка подписки на канал (вызывается автоматически при попытке создать видео)
bot.action('check_subscription', async (ctx) => {
    try {
        const userId = ctx.from.id;
        
        console.log(`🔍 Checking subscription for user ${userId}...`);
        
        const isSubscribed = await subscriptionService.checkSubscription(userId);
        
        if (isSubscribed) {
            // Подписка подтверждена - показываем сообщение с кнопкой бесплатной генерации
            await ctx.answerCbQuery('✅ Подписка подтверждена!');
            
            await ctx.editMessageText(
                subscriptionService.getSubscribedMessage(),
                { reply_markup: subscriptionService.getAfterSubscriptionKeyboard() }
            );
        } else {
            // Все еще не подписан - показываем сообщение с просьбой подписаться
            await ctx.answerCbQuery('❌ Сначала подпишись на канал!', { show_alert: true });
            
            await ctx.editMessageText(
                subscriptionService.getNotSubscribedMessage(),
                { reply_markup: subscriptionService.getNotSubscribedKeyboard() }
            );
        }
    } catch (err) {
        console.error('❌ Error in check_subscription:', err);
        await ctx.answerCbQuery('Произошла ошибка');
    }
});

// ЗАКОММЕНТИРОВАНО: Обработка кнопки "Использовать бесплатную генерацию"
// bot.action('use_free_generation', async (ctx) => {
//     try {
//         const userId = ctx.from.id;
//         const user = await userService.getUser(userId);
//         
//         // Проверяем, есть ли бесплатные генерации
//         if (!user || user.free_quota <= 0) {
//             await ctx.answerCbQuery('❌ У вас нет бесплатных генераций', { show_alert: true });
//             return;
//         }
//         
//         // Запрашиваем промпт для генерации
//         ctx.session = ctx.session || {};
//         ctx.session.waitingFor = 'free_prompt';
//         
//         await ctx.editMessageText(
//             `🎁 *Бесплатная генерация видео*\n\n` +
//             `📝 Опишите видео, которое хотите создать.\n\n` +
//             `*Примеры:*\n` +
//             `• Создай короткое видео с закатом на море\n` +
//             `• Мальчик танцует на улице\n` +
//             `• Кот играет с мячиком в саду\n\n` +
//             `Введите ваш промпт:`,
//             { 
//                 parse_mode: 'Markdown',
//                 reply_markup: {
//                     inline_keyboard: [
//                         [{ text: '🔙 Назад', callback_data: 'main_menu' }]
//                     ]
//                 }
//             }
//         );
//     } catch (err) {
//         console.error('❌ Error in use_free_generation:', err);
//         await ctx.answerCbQuery('Произошла ошибка');
//     }
// });

// Обработка каталога мемов
bot.action(/catalog.*/, async (ctx) => {
    try {
        await safeAnswerCbQuery(ctx); // Убираем индикатор загрузки
        const callbackData = ctx.callbackQuery.data;
        let page = 0;
        
        if (callbackData.includes('catalog_page_')) {
            page = parseInt(callbackData.replace('catalog_page_', ''));
        }
        
        const keyboard = createCatalogKeyboard(page);
        
        // Проверяем, есть ли текст в сообщении (если это видео или фото - текста нет)
        const message = ctx.callbackQuery.message;
        const hasText = message && message.text;
        const hasVideo = message && message.video;
        const hasCaption = message && message.caption;
        
        console.log('📊 Catalog callback debug:', {
            hasText,
            hasVideo,
            hasCaption,
            messageType: message ? (message.video ? 'video' : message.photo ? 'photo' : 'text') : 'unknown'
        });
        
        if (hasText) {
            // Если есть текст - редактируем
            try {
                await ctx.editMessageText(MESSAGES.MEMES_CATALOG, { reply_markup: keyboard });
            } catch (editErr) {
                console.log('⚠️ Failed to edit text message, sending new one');
                await ctx.reply(MESSAGES.MEMES_CATALOG, { reply_markup: keyboard });
            }
        } else {
            // Если текста нет (видео/фото) - просто отправляем новое сообщение
            console.log('✅ Sending new message (no text in original)');
            await ctx.reply(MESSAGES.MEMES_CATALOG, { reply_markup: keyboard });
        }
    } catch (err) {
        console.error('❌ Error in catalog:', err);
        await safeAnswerCbQuery(ctx, 'Произошла ошибка');
        // Пытаемся отправить новое сообщение с каталогом
        try {
            const keyboard = createCatalogKeyboard(0);
            await ctx.reply(MESSAGES.MEMES_CATALOG, { reply_markup: keyboard });
        } catch (replyErr) {
            console.error('❌ Failed to send catalog:', replyErr);
        }
    }
});

// Обработка кнопки "Свой промпт"
// Обработка кнопки "Как писать промпт?"
bot.action('prompt_guide', async (ctx) => {
    try {
        await safeAnswerCbQuery(ctx);
        
        const guideText = `💡 Как писать промпт для генерации видео\n\n` +
            `📝 Промпт - это текстовое описание того, что вы хотите увидеть в видео.\n\n` +
            `✅ Хорошие примеры:\n` +
            `• "A cat playing piano in a cozy room"\n` +
            `• "A person dancing on the street at sunset"\n` +
            `• "A dog running through a field of flowers"\n\n` +
            `❌ Плохие примеры:\n` +
            `• "Видео" (слишком общее)\n` +
            `• "Сделай что-нибудь" (нет конкретики)\n\n` +
            `💡 Советы:\n` +
            `1. Пишите на английском языке\n` +
            `2. Будьте конкретны в описании\n` +
            `3. Укажите действие, место, настроение\n` +
            `4. Избегайте сложных сцен\n\n` +
            `⚠️ Не используйте маты и оскорбления!`;
        
        await ctx.editMessageText(guideText, {
            reply_markup: {
                inline_keyboard: [
                    [{ text: '✍️ Создать свой мем', callback_data: 'custom_prompt' }],
                    [{ text: '🔙 Назад к каталогу', callback_data: 'catalog' }]
                ]
            }
        });
    } catch (err) {
        console.error('❌ Error in prompt_guide:', err);
        await safeAnswerCbQuery(ctx, 'Произошла ошибка');
    }
});

// Обработка кнопки создания видео
bot.action('create_video', async (ctx) => {
    try {
        await safeAnswerCbQuery(ctx);
        
        // Пытаемся отредактировать, если не получается - отправляем новое сообщение
        try {
            await ctx.editMessageText(
                MESSAGES.CREATE_VIDEO_MENU,
                {
                    parse_mode: 'Markdown',
                    disable_web_page_preview: true,
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '✍️ Написать свой промпт', callback_data: 'custom_prompt' }],
                            [{ text: '📝 Использовать шаблон', callback_data: 'catalog' }],
                            [{ text: '⏪ Вернуться назад', callback_data: 'main_menu' }]
                        ]
                    }
                }
            );
        } catch (editErr) {
            // Если не получилось отредактировать (например, это видео), отправляем новое сообщение
            await ctx.reply(
                MESSAGES.CREATE_VIDEO_MENU,
                {
                    parse_mode: 'Markdown',
                    disable_web_page_preview: true,
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '✍️ Написать свой промпт', callback_data: 'custom_prompt' }],
                            [{ text: '📝 Использовать шаблон', callback_data: 'catalog' }],
                            [{ text: '⏪ Вернуться назад', callback_data: 'main_menu' }]
                        ]
                    }
                }
            );
        }
    } catch (err) {
        console.error('❌ Error in create_video:', err);
        await safeAnswerCbQuery(ctx, 'Произошла ошибка');
    }
});

bot.action('custom_prompt', async (ctx) => {
    try {
        await safeAnswerCbQuery(ctx);
        
        // Проверяем подписку на канал
        const userId = ctx.from.id;
        const isSubscribed = await subscriptionService.checkSubscription(userId);
        
        if (!isSubscribed) {
            // Показываем предложение подписаться
            await ctx.editMessageText(
                subscriptionService.getSubscriptionMessage(),
                { 
                    reply_markup: {
                        inline_keyboard: [
                            [{ 
                                text: '✅ Подписаться', 
                                url: `https://t.me/${process.env.REQUIRED_CHANNEL?.replace('@', '') || 'meemee_official'}` 
                            }],
                            [{ 
                                text: '✔️ Я подписался, проверить', 
                                callback_data: 'check_subscription' 
                            }],
                            [{ 
                                text: '🔙 Назад', 
                                callback_data: 'create_video' 
                            }]
                        ]
                    }
                }
            );
            return;
        }
        
        // Проверяем квоту перед началом
        const hasQuota = await userService.hasQuota(userId);
        
        if (!hasQuota) {
            await ctx.editMessageText(MESSAGES.NO_QUOTA, {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '💳 Купить видео', callback_data: 'buy' }],
                        [{ text: '🔙 Назад', callback_data: 'catalog' }]
                    ]
                }
            });
            return;
        }
        
        // Сразу переходим к вводу промпта
        ctx.session = ctx.session || {};
        ctx.session.waitingFor = 'custom_prompt';
        
        await ctx.editMessageText(
            MESSAGES.CUSTOM_PROMPT_INPUT,
            {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '🔙 Назад', callback_data: 'create_video' }]
                    ]
                }
            }
        );
    } catch (err) {
        console.error('❌ Error in custom_prompt:', err);
        await safeAnswerCbQuery(ctx, 'Произошла ошибка');
    }
});

// Обработка начала ввода промпта
bot.action('start_custom_prompt', async (ctx) => {
    try {
        await safeAnswerCbQuery(ctx);
        
        // Устанавливаем флаг ожидания промпта
        ctx.session = ctx.session || {};
        ctx.session.waitingFor = 'custom_prompt';
        
        await ctx.editMessageText(
            MESSAGES.CUSTOM_PROMPT_INPUT,
            {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '⏪ Вернуться назад', callback_data: 'custom_prompt' }]
                    ]
                }
            }
        );
    } catch (err) {
        console.error('❌ Error in start_custom_prompt:', err);
        await safeAnswerCbQuery(ctx, 'Произошла ошибка');
    }
});

// Обработка показа полной инструкции
bot.action('show_full_guide', async (ctx) => {
    try {
        await safeAnswerCbQuery(ctx);
        
        await ctx.editMessageText(
            MESSAGES.PROMPT_GUIDE,
            {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '⏪ Вернуться назад', callback_data: 'custom_prompt' }]
                    ]
                }
            }
        );
    } catch (err) {
        console.error('❌ Error in show_full_guide:', err);
        await safeAnswerCbQuery(ctx, 'Произошла ошибка');
    }
});

// Обработка нажатия на кнопку с инструкцией по промптам
bot.action('prompt_guide', async (ctx) => {
    try {
        await safeAnswerCbQuery(ctx);
        await ctx.reply(MESSAGES.PROMPT_GUIDE, { parse_mode: 'Markdown' });
    } catch (err) {
        console.error('❌ Error in prompt guide handler:', err);
        await ctx.reply('Произошла ошибка при загрузке инструкции. Пожалуйста, попробуйте позже.');
    }
});

// Обработка выбора мема
bot.action(/meme_(.+)/, async (ctx) => {
    try {
        const memeId = ctx.match[1];
        const meme = getMemeById(memeId);
        
        if (!meme) {
            return await safeAnswerCbQuery(ctx, 'Мем не найден', { show_alert: true });
        }
        
        if (meme.status === 'soon') {
            return await safeAnswerCbQuery(ctx, MESSAGES.MEME_SOON, { show_alert: true });
        }
        
        await safeAnswerCbQuery(ctx); // Убираем индикатор загрузки
        
        // Проверяем подписку на канал
        const userId = ctx.from.id;
        const isSubscribed = await subscriptionService.checkSubscription(userId);
        
        if (!isSubscribed) {
            // Показываем предложение подписаться
            await ctx.editMessageText(
                subscriptionService.getSubscriptionMessage(),
                { 
                    reply_markup: {
                        inline_keyboard: [
                            [{ 
                                text: '✅ Подписаться', 
                                url: `https://t.me/${process.env.REQUIRED_CHANNEL?.replace('@', '') || 'meemee_official'}` 
                            }],
                            [{ 
                                text: '✔️ Я подписался, проверить', 
                                callback_data: 'check_subscription' 
                            }],
                            [{ 
                                text: '🔙 Назад', 
                                callback_data: 'catalog' 
                            }]
                        ]
                    }
                }
            );
            return;
        }
        
        // Проверяем квоту
        const hasQuota = await userService.hasQuota(userId);
        
        if (!hasQuota) {
            await ctx.editMessageText(MESSAGES.NO_QUOTA, {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '💳 Купить видео', callback_data: 'buy' }],
                        [{ text: '🔙 Назад', callback_data: 'catalog' }]
                    ]
                }
            });
            return;
        }
        
        // Сохраняем выбранный мем в контексте (для дальнейших шагов)
        ctx.session = ctx.session || {};
        ctx.session.selectedMeme = memeId;
        
        // Отправляем медиа-группу и текст с кнопкой
        if (memeId === 'mama_taxi' || memeId === 'mama_call') {
            try {
                // Отправляем медиа-группу (видео + фото с описанием)
                await ctx.replyWithMediaGroup([
                    {
                        type: 'video',
                        media: { source: './media/mother.MP4' }
                    },
                    {
                        type: 'photo',
                        media: { source: './media/statistic.jpeg' },
                        caption: `*${meme.name}*`,
                        parse_mode: 'Markdown'
                    }
                ]);
                
                // Отправляем призыв с кнопкой
                await ctx.reply(MESSAGES.ENTER_NAME, {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '🔙 Назад', callback_data: 'catalog' }]
                        ]
                    }
                });
            } catch (mediaErr) {
                console.log('⚠️ Failed to send media files:', mediaErr.message);
            }
        } else if (memeId === '228') {
            try {
                // Отправляем медиа-группу (видео + фото с описанием)
                await ctx.replyWithMediaGroup([
                    {
                        type: 'video',
                        media: { source: './media/mopsvideo.mp4' }
                    },
                    {
                        type: 'photo',
                        media: { source: './media/mops.jpeg' },
                        caption: `*${meme.name}*`,
                        parse_mode: 'Markdown'
                    }
                ]);
                
                // Отправляем призыв с кнопкой
                await ctx.reply(MESSAGES.ENTER_NAME, {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '🔙 Назад', callback_data: 'catalog' }]
                        ]
                    }
                });
            } catch (mediaErr) {
                console.log('⚠️ Failed to send media files:', mediaErr.message);
            }
        }
        
        // Устанавливаем флаг ожидания ввода имени
        ctx.session.waitingFor = 'name';
        ctx.session.memeId = memeId;
        
    } catch (err) {
        console.error('❌ Error selecting meme:', err);
        await safeAnswerCbQuery(ctx, 'Произошла ошибка');
    }
});

// Обработка текстовых сообщений (ввод имени)
bot.on('text', async (ctx) => {
    try {
        // Проверяем, является ли пользователь новым
        const userId = ctx.from.id;
        const existingUser = await userService.getUser(userId);
        
        if (!existingUser) {
            // Это новый пользователь - создаем его и показываем приветствие
            await userService.createUser(ctx.from);
            
            try {
                await ctx.replyWithPhoto(
                    { source: './media/start.png' },
                    {
                        caption: MESSAGES.WELCOME,
                        parse_mode: 'Markdown',
                        reply_markup: {
                            keyboard: [
                                [{ text: 'START' }]
                            ],
                            resize_keyboard: true,
                            one_time_keyboard: true
                        }
                    }
                );
            } catch (photoErr) {
                console.log('⚠️ Failed to send welcome photo, sending text instead');
                await ctx.reply(MESSAGES.WELCOME, { 
                    parse_mode: 'Markdown',
                    reply_markup: {
                        keyboard: [
                            [{ text: 'START' }]
                        ],
                        resize_keyboard: true,
                        one_time_keyboard: true
                    }
                });
            }
            return;
        }
        
        ctx.session = ctx.session || {};
        
        // Обработка кнопки START
        if (ctx.message.text === 'START') {
            const mainMenu = await createMainMenuKeyboard(userId);
            await ctx.reply(MESSAGES.MAIN_MENU, { 
                reply_markup: mainMenu
            });
            return;
        }
        
        if (ctx.session.waitingFor === 'custom_prompt') {
            const prompt = ctx.message.text.trim();
            
            // Валидация промпта
            if (prompt.length < 10) {
                return await ctx.reply('❌ Промпт слишком короткий. Опишите подробнее (минимум 10 символов).');
            }
            
            if (prompt.length > 1000) {
                return await ctx.reply('❌ Промпт слишком длинный. Максимум 1000 символов.');
            }
            
            const userId = ctx.from.id;
            
            // Списываем квоту
            const deducted = await userService.deductQuota(userId);
            if (!deducted) {
                return await ctx.reply('❌ Недостаточно генераций');
            }
            
            // Создаём генерацию с пользовательским промптом
            const generation = await generationService.createGeneration({
                userId,
                chatId: ctx.chat.id,
                memeId: 'custom',
                name: 'Custom',
                gender: 'male',
                customPrompt: prompt
            });
            
            if (generation.error) {
                // Возвращаем квоту при ошибке
                await userService.refundQuota(userId);
                return await ctx.reply('❌ Ошибка создания генерации: ' + generation.error);
            }
            
            // Отправляем сообщение о генерации (без названия мема для custom)
            await ctx.reply(MESSAGES.GENERATION_STARTED(null), {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '✨ Создать еще', callback_data: 'create_video' }],
                        [{ text: '⏪ Вернуться назад', callback_data: 'main_menu' }]
                    ]
                }
            });
            
            // Сохраняем промпт для отправки админам ПОСЛЕ генерации
            ctx.session.customPromptData = {
                userId,
                username: ctx.from.username || 'нет',
                firstName: ctx.from.first_name || '',
                prompt,
                generationId: generation.generationId,
                timestamp: new Date().toISOString()
            };
            
            // Очищаем флаг ожидания
            delete ctx.session.waitingFor;
            
        } else if (ctx.session.waitingFor === 'free_prompt') {
            const prompt = ctx.message.text.trim();
            
            // Валидация промпта
            if (prompt.length < 10) {
                return await ctx.reply('❌ Промпт слишком короткий. Опишите подробнее (минимум 10 символов).');
            }
            
            if (prompt.length > 500) {
                return await ctx.reply('❌ Промпт слишком длинный. Максимум 500 символов.');
            }
            
            // Проверка на спам и запрещённые слова
            const badWords = [
                'хуй', 'пизд', 'ебл', 'ебан', 'ебат', 'бля', 'сука', 'уеб', 
                'мудак', 'мудил', 'гандон', 'педик', 'пидор', 'хер', 'манда',
                'шлюха', 'блядь', 'ублюдок', 'долбоеб', 'говно', 'жопа',
                'fuck', 'shit', 'bitch', 'ass', 'dick', 'cunt', 'whore'
            ];
            const hasBadWords = badWords.some(word => prompt.toLowerCase().includes(word));
            
            if (hasBadWords) {
                return await ctx.reply('❌ Пожалуйста, используйте корректное описание без оскорблений.');
            }
            
            const userId = ctx.from.id;
            
            // Списываем квоту
            const deducted = await userService.deductQuota(userId);
            if (!deducted) {
                return await ctx.reply('❌ Недостаточно бесплатных генераций');
            }
            
            // Создаём генерацию с пользовательским промптом
            const generation = await generationService.createGeneration({
                userId,
                chatId: ctx.chat.id, // Добавляем chatId для уведомлений
                memeId: 'custom',
                name: 'Custom',
                gender: 'male',
                customPrompt: prompt
            });
            
            if (generation.error) {
                // Возвращаем квоту при ошибке
                await userService.refundQuota(userId);
                return await ctx.reply('❌ Ошибка создания генерации: ' + generation.error);
            }
            
            await ctx.reply(MESSAGES.GENERATION_STARTED);
            
            // Ожидаем завершения генерации
            await waitForGeneration(ctx, generation.generationId);
            
            // Очищаем сессию
            delete ctx.session.waitingFor;
            
        } else if (ctx.session.waitingFor === 'name') {
            const name = ctx.message.text.trim();
            
            // Валидация имени
            if (name.length < 2 || name.length > 30) {
                return await ctx.reply('❌ Имя должно быть от 2 до 30 символов. Попробуйте ещё раз.');
            }
            
            // Проверка на маты и запрещённые слова
            const badWords = [
                'хуй', 'пизд', 'ебл', 'ебан', 'ебат', 'бля', 'сука', 'уеб', 
                'мудак', 'мудил', 'гандон', 'педик', 'пидор', 'хер', 'манда',
                'шлюха', 'блядь', 'ублюдок', 'долбоеб', 'говно', 'жопа',
                'fuck', 'shit', 'bitch', 'ass', 'dick', 'cunt', 'whore'
            ];
            const hasBadWords = badWords.some(word => name.toLowerCase().includes(word));
            
            if (hasBadWords) {
                return await ctx.reply('❌ Пожалуйста, используйте корректное имя без оскорблений.');
            }
            
            // Сохраняем имя и запрашиваем пол
            ctx.session.generationName = name;
            ctx.session.waitingFor = 'gender';
            
            await ctx.reply(MESSAGES.CHOOSE_GENDER, { reply_markup: GENDER_CHOICE });
            
        } else if (ctx.session.waitingFor === 'email') {
            // Обработка ввода email для оплаты картой
            const email = ctx.message.text.trim();
            
            // Простая валидация email
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                return await ctx.reply(
                    MESSAGES.EMAIL_INVALID,
                    {
                        reply_markup: {
                            inline_keyboard: [
                                [{ text: '⏪ Вернуться назад', callback_data: `select_package_${ctx.session.selectedPackage || 'single'}` }]
                            ]
                        }
                    }
                );
            }
            
            const packageKey = ctx.session.selectedPackage || 'single';
            const pkg = PACKAGES[packageKey];
            
            ctx.session.email = email;
            delete ctx.session.waitingFor;
            
            // Создаём платёж через Lava
            const payment = await paymentFiatService.createPayment({
                userId: ctx.from.id,
                email: email,
                amount: pkg.rub,
                bank: 'BANK131',
                package: packageKey
            });
            
            if (payment.error) {
                return await ctx.reply('❌ Ошибка создания платежа: ' + payment.error);
            }
            
            await ctx.reply(
                MESSAGES.PAYMENT_CARD_CONFIRM(pkg),
                {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '✅ Оплатить', url: payment.output.paymentUrl }],
                            [{ text: '📝 Договор-оферта', url: 'https://telegra.ph/Dogovor-oferta-11-04' }],
                            [{ text: '📝 Политика конфиденциальности', url: 'https://telegra.ph/Politika-konfidencialnosti-11-04' }],
                            [{ text: '❓ Обратная связь', url: `https://t.me/${process.env.SUPPORT_USERNAME || 'aiviral_manager'}` }],
                            [{ text: '⏪ Вернуться назад', callback_data: `select_package_${packageKey}` }]
                        ]
                    }
                }
            );
        }
    } catch (err) {
        console.error('❌ Error in text handler:', err);
        await ctx.reply('Произошла ошибка. Попробуйте позже.');
    }
});

// Обработка выбора пола
bot.action(/gender_(male|female)/, async (ctx) => {
    try {
        await safeAnswerCbQuery(ctx); // Убираем индикатор загрузки
        
        ctx.session = ctx.session || {};
        const gender = ctx.match[1];
        ctx.session.generationGender = gender;
        
        const name = ctx.session.generationName;
        const genderText = gender === 'male' ? 'Мальчик' : 'Девочка';
        
        await ctx.editMessageText(
            MESSAGES.CONFIRM_GENERATION(name, gender),
            { reply_markup: CONFIRM_GENERATION }
        );
    } catch (err) {
        console.error('❌ Error in gender selection:', err);
        await safeAnswerCbQuery(ctx, 'Произошла ошибка');
    }
});

// Подтверждение генерации
bot.action('confirm_gen', async (ctx) => {
    try {
        const userId = ctx.from.id;
        const memeId = ctx.session.memeId;
        const name = ctx.session.generationName;
        const gender = ctx.session.generationGender;
        
        // Списываем квоту
        const deducted = await userService.deductQuota(userId);
        if (!deducted) {
            return await safeAnswerCbQuery(ctx, 'Недостаточно генераций', { show_alert: true });
        }
        
        // Создаём генерацию
        const generation = await generationService.createGeneration({
            userId,
            chatId: ctx.chat.id, // Добавляем chatId для уведомлений
            memeId,
            name,
            gender
        });
        
        if (generation.error) {
            // Возвращаем квоту при ошибке
            await userService.refundQuota(userId);
            return await safeAnswerCbQuery(ctx, 'Ошибка создания генерации', { show_alert: true });
        }
        
        // Получаем название мема
        const meme = getMemeById(memeId);
        const memeName = meme ? meme.name : null;
        
        // Отправляем сообщение о генерации
        await ctx.reply(MESSAGES.GENERATION_STARTED(memeName), {
            reply_markup: {
                inline_keyboard: [
                    [{ text: '✨ Создать еще', callback_data: 'create_video' }],
                    [{ text: '⏪ Вернуться назад', callback_data: 'main_menu' }]
                ]
            }
        });
        
        // Ожидаем завершения генерации
        await waitForGeneration(ctx, generation.generationId);
        
        // Очищаем сессию
        delete ctx.session.memeId;
        delete ctx.session.generationName;
        delete ctx.session.generationGender;
        delete ctx.session.waitingFor;
        
    } catch (err) {
        console.error('❌ Error confirming generation:', err);
        await ctx.answerCbQuery('Произошла ошибка');
    }
});

// Обработка загрузки видео на YouTube
bot.action(/upload_youtube_(.+)/, async (ctx) => {
    try {
        await safeAnswerCbQuery(ctx);
        
        const userId = ctx.from.id;
        const generationId = ctx.match[1];
        const generation = await generationService.getGeneration(generationId);
        
        if (!generation || !generation.videoUrl) {
            return await ctx.reply('❌ Видео не найдено');
        }
        
        // Проверяем, не загружено ли уже
        if (generation.youtubeUrl) {
            return await ctx.reply(
                `✅ Видео уже загружено на YouTube!\n\n🔗 ${generation.youtubeUrl}`,
                {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '🏠 Главное меню', callback_data: 'main_menu' }]
                        ]
                    }
                }
            );
        }
        
        // Проверяем, авторизован ли пользователь
        const { YouTubeAuthService } = await import('./services/YouTubeAuth.service.js');
        const authService = new YouTubeAuthService();
        const isAuthorized = await authService.isUserAuthorized(userId);
        
        if (!isAuthorized) {
            const authUrl = authService.getAuthUrl(userId);
            return await ctx.reply(
                '📺 Для загрузки видео на YouTube нужно подключить ваш канал.\n\n' +
                'Нажмите кнопку ниже для авторизации:',
                {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '🔗 Подключить YouTube', url: authUrl }],
                            [{ text: '🔙 Назад', callback_data: 'main_menu' }]
                        ]
                    }
                }
            );
        }
        
        await ctx.reply('⏳ Загружаем видео на YouTube, это может занять несколько минут...');
        
        // Загружаем на YouTube
        const youtubeResult = await generationService.uploadToYouTube(generation, generation.videoUrl);
        
        if (youtubeResult && youtubeResult.success) {
            await generationService.updateGeneration(generationId, {
                youtubeUrl: youtubeResult.videoUrl,
                youtubeVideoId: youtubeResult.videoId
            });
            
            await ctx.reply(
                `✅ Видео успешно загружено на ваш YouTube канал!\n\n🔗 ${youtubeResult.videoUrl}`,
                {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '🎬 Создать еще', callback_data: 'create_video' }],
                            [{ text: '🏠 Главное меню', callback_data: 'main_menu' }]
                        ]
                    }
                }
            );
        } else {
            await ctx.reply(
                '❌ Не удалось загрузить видео на YouTube.\n\n' +
                (youtubeResult?.error || 'Произошла неизвестная ошибка'),
                {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '🔄 Попробовать снова', callback_data: `upload_youtube_${generationId}` }],
                            [{ text: '🏠 Главное меню', callback_data: 'main_menu' }]
                        ]
                    }
                }
            );
        }
        
    } catch (err) {
        console.error('❌ Error uploading to YouTube:', err);
        await ctx.reply('❌ Произошла ошибка при загрузке на YouTube');
    }
});

// Функция быстрой проверки статуса генерации
async function waitForGeneration(ctx, generationId, quickCheckAttempts = 10) {
    // Делаем быструю проверку в течение 30 секунд (10 попыток по 3 секунды)
    // Если видео готово быстро - отправляем сразу
    // Иначе сообщаем что видео придет позже автоматически
    
    for (let i = 0; i < quickCheckAttempts; i++) {
        await new Promise(resolve => setTimeout(resolve, 3000)); // Проверяем каждые 3 секунды
        
        const generation = await generationService.getGeneration(generationId);
        
        if (generation.status === 'done' && generation.videoUrl) {
            // Увеличиваем счетчик успешных генераций
            const user = await userService.getUser(ctx.from.id);
            if (user) {
                await userService.updateUser(ctx.from.id, {
                    successful_generations: (user.successful_generations || 0) + 1
                });
            }
            
            try {
                await ctx.replyWithVideo(
                    { url: generation.videoUrl },
                    { 
                        caption: '✅ Ваше видео готово!\n\n🎬 Генерация успешно завершена!',
                        reply_markup: {
                            inline_keyboard: [
                                [{ text: '👥 Поделиться с другом', switch_inline_query: generation.generationId }],
                                [{ text: '🎬 Сгенерировать еще', callback_data: 'create_video' }],
                                [{ text: '🏠 Главное меню', callback_data: 'main_menu' }]
                            ]
                        }
                    }
                );
            } catch (err) {
                await ctx.reply(
                    '✅ Ваше видео готово!\n\n🎬 Генерация успешно завершена!\n\n' +
                    '🔗 Ссылка на видео: ' + generation.videoUrl,
                    {
                        reply_markup: {
                            inline_keyboard: [
                                [{ text: '👥 Поделиться с другом', switch_inline_query: generation.generationId }],
                                [{ text: '🎬 Сгенерировать еще', callback_data: 'create_video' }],
                                [{ text: '🏠 Главное меню', callback_data: 'main_menu' }]
                            ]
                        }
                    }
                );
            }
            return;
        } else if (generation.status === 'failed') {
            // Возвращаем квоту
            await userService.refundQuota(ctx.from.id);
            
            // Увеличиваем счетчик ошибок
            const user = await userService.getUser(ctx.from.id);
            if (user) {
                await userService.updateUser(ctx.from.id, {
                    failed_generations: (user.failed_generations || 0) + 1
                });
            }
            
            const errorId = generation.errorId || 'UNKNOWN';
            await ctx.reply(
                'Упс, произошла ошибка, со стороны нейронки! Попробуйте еще раз.❤️',
                {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '😍 Попробовать еще раз', callback_data: 'create_video' }]
                        ]
                    }
                }
            );
            return;
        }
    }
    
    // Если за 30 секунд видео не готово - первое сообщение с фоткой уже информирует пользователя
    // Дополнительное сообщение не требуется
}

// Inline режим для пересылки видео
bot.on('inline_query', async (ctx) => {
    try {
        const userId = ctx.from.id;
        const query = ctx.inlineQuery.query.trim();
        
        console.log(`🔍 Inline query from user ${userId}, query: "${query}"`);
        
        // Получаем генерации пользователя
        const generations = await generationService.getUserGenerations(userId);
        console.log(`📊 User has ${generations.length} total generations`);
        
        let targetVideo = null;
        
        // Если есть query (ID генерации), ищем конкретное видео
        if (query) {
            targetVideo = generations.find(g => g.generationId === query && g.status === 'done' && g.videoUrl);
            console.log(`🎯 Looking for specific video: ${query}`);
        }
        
        // Если не нашли конкретное видео или query пустой, берем последнее
        if (!targetVideo) {
            targetVideo = generations.find(g => g.status === 'done' && g.videoUrl);
            console.log(`📹 Using last video as fallback`);
        }
        
        if (!targetVideo) {
            console.log('❌ No completed video found for inline query');
            // Отправляем пустой результат с сообщением
            return await ctx.answerInlineQuery([], {
                cache_time: 0,
                switch_pm_text: 'Создать видео',
                switch_pm_parameter: 'create'
            });
        }
        
        console.log(`✅ Found video: ${targetVideo.generationId}`);
        console.log(`   Video URL: ${targetVideo.videoUrl}`);
        console.log(`   Telegram file_id: ${targetVideo.telegramFileId || 'not available'}`);
        
        // Создаем результат для inline режима
        const results = [];
        
        // Если есть file_id (видео с водяным знаком), используем его
        if (targetVideo.telegramFileId) {
            results.push({
                type: 'video',
                id: targetVideo.generationId,
                video_file_id: targetVideo.telegramFileId,
                title: `🎬 ${targetVideo.memeName}`,
                description: `Видео с именем: ${targetVideo.name}`,
                caption: `🎬 Смотри какое крутое видео я создал в @${process.env.BOT_NAME}!\n\n✨ Ты тоже можешь создать своё!`,
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '🎬 Создать своё видео', url: `https://t.me/${process.env.BOT_NAME}` }]
                    ]
                }
            });
        } else {
            // Fallback на URL (без водяного знака)
            results.push({
                type: 'video',
                id: targetVideo.generationId,
                video_url: targetVideo.videoUrl,
                mime_type: 'video/mp4',
                thumb_url: targetVideo.videoUrl,
                title: `🎬 ${targetVideo.memeName}`,
                description: `Видео с именем: ${targetVideo.name}`,
                caption: `🎬 Смотри какое крутое видео я создал в @${process.env.BOT_NAME}!\n\n✨ Ты тоже можешь создать своё!`,
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '🎬 Создать своё видео', url: `https://t.me/${process.env.BOT_NAME}` }]
                    ]
                }
            });
        }
        
        console.log(`📤 Sending inline query result with video`);
        await ctx.answerInlineQuery(results, { cache_time: 0 });
        console.log(`✅ Inline query answered successfully`);
    } catch (err) {
        console.error('❌ Error in inline_query:', err);
        console.error(err.stack);
        await ctx.answerInlineQuery([], {
            cache_time: 0,
            switch_pm_text: 'Создать видео',
            switch_pm_parameter: 'create'
        });
    }
});

// Импорт контроллеров платежей
import * as paymentController from './controllers/paymentController.js';

// Обработка кнопки "Купить видео"
bot.action('buy', (ctx) => paymentController.handleBuy(ctx));

// Обработка выбора пакета
bot.action(/select_package_(.+)/, (ctx) => {
    const packageKey = ctx.match[1];
    paymentController.handleSelectPackage(ctx, packageKey);
});

// Обработка кнопки "О проекте"
bot.action('about', (ctx) => paymentController.handleAbout(ctx));

// Обработка личного кабинета
bot.action('profile', (ctx) => paymentController.handleProfile(ctx));
bot.action('profile_history', (ctx) => paymentController.handleProfileHistory(ctx));
bot.action(/^profile_history:(\d+)$/, (ctx) => paymentController.handleProfileHistory(ctx));

// Обработка реферальной программы
bot.action('referral', (ctx) => paymentController.handleReferral(ctx));
bot.action('ref_user', (ctx) => paymentController.handleRefUser(ctx));
bot.action('ref_expert', (ctx) => paymentController.handleRefExpert(ctx));

// Обработка оплаты
bot.action(/pay_card_(.+)/, (ctx) => {
    const packageKey = ctx.match[1];
    paymentController.handlePayCard(ctx, packageKey);
});
bot.action(/pay_crypto_(.+)/, (ctx) => {
    const packageKey = ctx.match[1];
    paymentController.handlePayCrypto(ctx, packageKey);
});
bot.action(/pay_stars_(.+)/, (ctx) => {
    const packageKey = ctx.match[1];
    paymentController.handlePayStarsSoon(ctx, packageKey);
});

// Обработка выбора криптовалюты
bot.action(/crypto_([A-Z]+)_(.+)/, (ctx) => {
    const crypto = ctx.match[1];
    const packageKey = ctx.match[2];
    console.log('🔍 DEBUG crypto callback:', {
        fullData: ctx.callbackQuery.data,
        match: ctx.match,
        crypto,
        packageKey
    });
    paymentController.handleCryptoSelect(ctx, crypto, packageKey);
});

// Обработка выбора сети
bot.action(/chain_(.+)/, (ctx) => {
    // Разбираем callback_data вручную
    const parts = ctx.callbackQuery.data.split('_');
    // Формат: chain_CRYPTO_CHAIN_PACKAGE
    // chain_TON_TON_single => ['chain', 'TON', 'TON', 'single']
    // chain_USDT_USDT_(TRC20)_pack_10 => ['chain', 'USDT', 'USDT', '(TRC20)', 'pack', '10']
    
    if (parts.length < 4) {
        console.error('❌ Invalid chain callback format:', ctx.callbackQuery.data);
        return ctx.answerCbQuery('Ошибка формата данных');
    }
    
    const crypto = parts[1]; // USDT, USDC, TON
    
    // Находим packageKey - это последний сегмент, который начинается с 'single', 'pack' или является 'pack_X'
    let packageKey = '';
    let chainParts = [];
    
    // Идем с конца и собираем packageKey
    for (let i = parts.length - 1; i >= 2; i--) {
        if (parts[i].match(/^(single|pack|10|50|100|500)$/)) {
            if (parts[i] === 'pack' && parts[i + 1]) {
                packageKey = `pack_${parts[i + 1]}`;
                chainParts = parts.slice(2, i);
                break;
            } else if (parts[i] === 'single') {
                packageKey = 'single';
                chainParts = parts.slice(2, i);
                break;
            }
        }
    }
    
    // Если не нашли packageKey стандартным способом, значит это single и все остальное - chain
    if (!packageKey) {
        packageKey = parts[parts.length - 1];
        chainParts = parts.slice(2, -1);
    }
    
    const chain = chainParts.join('_');
    
    console.log('🔍 Chain selection:', { crypto, chain, packageKey, original: ctx.callbackQuery.data });
    
    paymentController.handleChainSelect(ctx, crypto, chain, packageKey);
});

// Обработка проверки платежа
bot.action(/check_payment_(.+)/, (ctx) => {
    const orderId = ctx.match[1];
    paymentController.handleCheckPayment(ctx, orderId);
});

// Обработка неизвестных callback (для отладки)
bot.on('callback_query', async (ctx) => {
    // Проверяем, был ли callback уже обработан
    if (ctx.callbackQuery.data && !ctx.callbackQuery.answered) {
        const callbackData = ctx.callbackQuery.data;
        console.log('⚠️ Unhandled callback:', callbackData);
        await safeAnswerCbQuery(ctx, 'Функция в разработке');
    }
});

// Функция уведомления админов об ошибке
async function notifyAdminsAboutError(error, ctx) {
    try {
        const { ADMINS } = await import('./config.js');
        const adminBotToken = process.env.BOT_TOKEN_ADMIN;
        
        if (!adminBotToken || !ADMINS || ADMINS.length === 0) {
            return;
        }
        
        const { Telegraf } = await import('telegraf');
        const adminBot = new Telegraf(adminBotToken);
        
        const time = new Date().toLocaleString('ru-RU');
        let message = `🔴 ОШИБКА В БОТЕ\n\n`;
        message += `⏰ Время: ${time}\n`;
        message += `❌ Тип: ${error.name || 'Error'}\n`;
        message += `💬 Сообщение: ${error.message}\n`;
        
        if (ctx?.from?.id) {
            message += `👤 User ID: ${ctx.from.id}\n`;
        }
        
        if (error.stack) {
            const stackLines = error.stack.split('\n').slice(0, 3);
            message += `\n📍 Stack:\n${stackLines.join('\n')}`;
        }
        
        // Отправляем всем админам
        for (const adminId of ADMINS) {
            try {
                await adminBot.telegram.sendMessage(adminId, message, {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '❌ Посмотреть все ошибки', callback_data: 'errors' }]
                        ]
                    }
                });
            } catch (sendErr) {
                console.error(`Failed to notify admin ${adminId}:`, sendErr.message);
            }
        }
    } catch (err) {
        console.error('Failed to notify admins about error:', err);
    }
}

// Обработка ошибок
bot.catch(async (err, ctx) => {
    console.error('❌ Bot error:', err);
    
    // Логируем ошибку в систему
    const errorData = await errorLogger.logError({
        message: err.message,
        stack: err.stack,
        name: err.name || 'BotError',
        source: 'Main Bot',
        context: {
            userId: ctx?.from?.id,
            chatId: ctx?.chat?.id,
            updateType: ctx?.updateType
        }
    });
    
    // Отправляем уведомление админам
    await notifyAdminsAboutError(err, ctx);
    
    if (ctx) {
        ctx.reply(`❌ Произошла ошибка номер ${errorData.id}. Обратитесь к менеджеру @aiviral_manager с номером ошибки.`)
            .catch(e => console.error('Failed to send error message:', e));
    }
});

// Запуск бота
const USE_WEBHOOK = process.env.USE_WEBHOOK === 'true';

if (USE_WEBHOOK) {
    // Webhook режим - бот будет работать через веб-сервер
    console.log('🌐 Bot configured for webhook mode');
    console.log('⚠️  Webhook will be handled by backend server');
    console.log('✅ Bot handlers initialized and ready');
} else {
    // Polling режим - обычный режим
    bot.launch()
        .then(async () => {
            console.log('✅ MeeMee bot started successfully (polling mode)!');
            console.log(`Bot username: @${bot.botInfo.username}`);
            
            // Восстанавливаем зависшие генерации
            try {
                await generationService.recoverPendingGenerations();
            } catch (err) {
                console.error('⚠️ Error recovering pending generations:', err.message);
            }
        })
        .catch(err => {
            console.error('❌ Failed to start bot:', err);
            process.exit(1);
        });
}

// Graceful shutdown
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

// Экспортируем бота для использования в backend
export default bot;
