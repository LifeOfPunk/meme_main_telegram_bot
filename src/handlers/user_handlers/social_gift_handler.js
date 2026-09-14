import { UserService } from '../../services/User.service.js';

const userService = new UserService();

export const SOCIAL_LINKS = {
    INSTAGRAM: 'https://instagram.com/aiviral.agency',
    YOUTUBE: 'https://youtube.com/@aiviral-media',
    TIKTOK: 'https://tiktok.com/@aiviral.media',
    TELEGRAM: 'https://t.me/aiviral_media'
};

const BONUS_GENERATIONS = parseInt(process.env.SOCIAL_GIFT_BONUS_GENERATIONS || '1', 10);

/**
 * Клавиатура со ссылками на соцсети и кнопкой получения подарка
 */
export function getSocialGiftKeyboard(hasClaimed = false) {
    const inline_keyboard = [
        [
            { text: '📸 Instagram', url: SOCIAL_LINKS.INSTAGRAM },
            { text: '🎥 YouTube', url: SOCIAL_LINKS.YOUTUBE }
        ],
        [
            { text: '🎵 TikTok', url: SOCIAL_LINKS.TIKTOK },
            { text: '📢 Telegram', url: SOCIAL_LINKS.TELEGRAM }
        ]
    ];

    if (hasClaimed) {
        inline_keyboard.push([
            { text: '✅ Подарок уже получен', callback_data: 'social_gift_already_claimed' }
        ]);
    } else {
        inline_keyboard.push([
            { text: '🎁 Я подписался, забрать подарок', callback_data: 'claim_social_gift' }
        ]);
    }

    inline_keyboard.push([
        { text: '🔙 Главное меню', callback_data: 'main_menu' }
    ]);

    return { inline_keyboard };
}

/**
 * Сообщение с соцсетями и описанием подарка
 */
export function getSocialGiftMessage(hasClaimed = false) {
    let msg = `🎁 *Подписывайся на наши соцсети и забирай подарок!*\n\n` +
        `Подпишись на наши каналы, чтобы быть в курсе трендов, смотреть вирусные ролики и первыми получать бонусы:\n\n` +
        `📸 *Instagram:* [aiviral.agency](${SOCIAL_LINKS.INSTAGRAM})\n` +
        `🎥 *YouTube:* [@aiviral-media](${SOCIAL_LINKS.YOUTUBE})\n` +
        `🎵 *TikTok:* [@aiviral.media](${SOCIAL_LINKS.TIKTOK})\n` +
        `📢 *Telegram:* [AIVIRAL Media](${SOCIAL_LINKS.TELEGRAM})\n\n`;

    if (hasClaimed) {
        msg += `✨ *Вы уже забрали свой подарок!* Спасибо за подписку и поддержку нашего сообщества ❤️`;
    } else {
        msg += `🚀 Подпишись на соцсети и нажми кнопку ниже, чтобы получить *+${BONUS_GENERATIONS} бесплатную генерацию*!`;
    }

    return msg;
}

/**
 * Безопасный ответ на callback query
 */
async function safeAnswerCbQuery(ctx, text, options = {}) {
    try {
        await ctx.answerCbQuery(text, options);
    } catch (err) {
        // Игнорируем устаревшие query
    }
}

/**
 * Экран шага ввода Instagram
 */
export async function showInstagramPrompt(ctx) {
    const text = `🎁 *Шаг 1 из 2: Instagram*\n\n` +
        `Напишите ваш никнейм в Instagram (например, \`@username\` или ссылку на профиль):\n\n` +
        `_Если у вас нет аккаунта Instagram, вы можете пропустить этот шаг._`;

    const reply_markup = {
        inline_keyboard: [
            [{ text: '⏭️ Пропустить Instagram', callback_data: 'social_gift_skip_ig' }],
            [{ text: '❌ Отмена', callback_data: 'social_gift_cancel' }]
        ]
    };

    if (ctx.callbackQuery) {
        try {
            await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup });
            return;
        } catch (e) {
            // fallback к reply
        }
    }
    await ctx.reply(text, { parse_mode: 'Markdown', reply_markup });
}

/**
 * Экран шага ввода YouTube
 */
export async function showYouTubePrompt(ctx) {
    const text = `🎁 *Шаг 2 из 2: YouTube*\n\n` +
        `Напишите ваш никнейм или название канала на YouTube (например, \`@channel\` или ссылку):\n\n` +
        `_Если у вас нет канала на YouTube, вы можете пропустить этот шаг._`;

    const reply_markup = {
        inline_keyboard: [
            [{ text: '⏭️ Пропустить YouTube', callback_data: 'social_gift_skip_yt' }],
            [{ text: '❌ Отмена', callback_data: 'social_gift_cancel' }]
        ]
    };

    if (ctx.callbackQuery) {
        try {
            await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup });
            return;
        } catch (e) {
            // fallback к reply
        }
    }
    await ctx.reply(text, { parse_mode: 'Markdown', reply_markup });
}

/**
 * Завершение выдачи подарка и сохранение лида
 */
export async function completeSocialGiftClaim(ctx) {
    const userId = ctx.from.id;
    const leadData = ctx.session?.socialLead || {};

    leadData.telegram_id = userId;
    leadData.username = ctx.from.username || null;
    leadData.first_name = ctx.from.first_name || null;

    // Очищаем FSM
    delete ctx.session.waitingFor;
    delete ctx.session.socialLead;

    const result = await userService.claimSocialGift(userId, leadData, BONUS_GENERATIONS);

    if (!result.success && result.alreadyClaimed) {
        const text = `⚠️ *Подарок уже был получен ранее.*\n\nБонус за подписку на соцсети начисляется один раз на аккаунт. Спасибо за поддержку!`;
        const reply_markup = {
            inline_keyboard: [
                [{ text: '🏠 Главное меню', callback_data: 'main_menu' }]
            ]
        };
        return await ctx.reply(text, { parse_mode: 'Markdown', reply_markup });
    }

    const successText = `🎉 *Поздравляем! Подарок начислен!*\n\n` +
        `Вам успешно начислено *+${result.bonusGenerations || BONUS_GENERATIONS} бесплатная генерация* 🎁\n\n` +
        `Применяйте ИИ для создания вирусных роликов прямо сейчас!`;

    const reply_markup = {
        inline_keyboard: [
            [{ text: '🎬 Сгенерировать видео', callback_data: 'create_video_free' }],
            [{ text: '🏠 Главное меню', callback_data: 'main_menu' }]
        ]
    };

    await ctx.reply(successText, { parse_mode: 'Markdown', reply_markup });
}

/**
 * Регистрация обработчиков соцсетей и сбора лидов
 */
export function registerSocialGiftHandlers(bot) {
    // 1. Показ главного экрана соцсетей с ссылками и подарком
    bot.action('social_gift', async (ctx) => {
        try {
            await safeAnswerCbQuery(ctx);
            const userId = ctx.from.id;
            const hasClaimed = await userService.hasClaimedSocialGift(userId);
            const message = getSocialGiftMessage(hasClaimed);
            const keyboard = getSocialGiftKeyboard(hasClaimed);

            await ctx.editMessageText(message, {
                parse_mode: 'Markdown',
                reply_markup: keyboard,
                disable_web_page_preview: true
            });
        } catch (err) {
            console.error('❌ Error in social_gift action:', err);
            try {
                const userId = ctx.from.id;
                const hasClaimed = await userService.hasClaimedSocialGift(userId);
                await ctx.reply(getSocialGiftMessage(hasClaimed), {
                    parse_mode: 'Markdown',
                    reply_markup: getSocialGiftKeyboard(hasClaimed),
                    disable_web_page_preview: true
                });
            } catch (fallbackErr) {
                await safeAnswerCbQuery(ctx, 'Произошла ошибка');
            }
        }
    });

    // 2. Нажатие кнопки "Я подписался, забрать подарок"
    bot.action('claim_social_gift', async (ctx) => {
        try {
            const userId = ctx.from.id;
            const hasClaimed = await userService.hasClaimedSocialGift(userId);

            if (hasClaimed) {
                await safeAnswerCbQuery(ctx, 'Вы уже получили подарок!', { show_alert: true });
                return;
            }

            await safeAnswerCbQuery(ctx);

            ctx.session = ctx.session || {};
            ctx.session.waitingFor = 'social_gift_instagram';
            ctx.session.socialLead = {
                telegram_id: userId,
                username: ctx.from.username || null,
                first_name: ctx.from.first_name || null
            };

            await showInstagramPrompt(ctx);
        } catch (err) {
            console.error('❌ Error in claim_social_gift:', err);
            await safeAnswerCbQuery(ctx, 'Произошла ошибка');
        }
    });

    // 3. Обработка нажатия на "Подарок уже получен"
    bot.action('social_gift_already_claimed', async (ctx) => {
        await safeAnswerCbQuery(ctx, 'Вы уже забрали свой бонус за подписку!', { show_alert: true });
    });

    // 4. Пропуск ввода Instagram
    bot.action('social_gift_skip_ig', async (ctx) => {
        try {
            await safeAnswerCbQuery(ctx);
            ctx.session = ctx.session || {};
            ctx.session.socialLead = ctx.session.socialLead || {};
            ctx.session.socialLead.instagram_handle = null;
            ctx.session.waitingFor = 'social_gift_youtube';

            await showYouTubePrompt(ctx);
        } catch (err) {
            console.error('❌ Error in social_gift_skip_ig:', err);
            await safeAnswerCbQuery(ctx, 'Произошла ошибка');
        }
    });

    // 5. Пропуск ввода YouTube
    bot.action('social_gift_skip_yt', async (ctx) => {
        try {
            await safeAnswerCbQuery(ctx);
            ctx.session = ctx.session || {};
            ctx.session.socialLead = ctx.session.socialLead || {};
            ctx.session.socialLead.youtube_handle = null;

            await completeSocialGiftClaim(ctx);
        } catch (err) {
            console.error('❌ Error in social_gift_skip_yt:', err);
            await safeAnswerCbQuery(ctx, 'Произошла ошибка');
        }
    });

    // 6. Отмена ввода данных для подарка
    bot.action('social_gift_cancel', async (ctx) => {
        try {
            await safeAnswerCbQuery(ctx, 'Отменено');
            if (ctx.session) {
                delete ctx.session.waitingFor;
                delete ctx.session.socialLead;
            }
            const userId = ctx.from.id;
            const hasClaimed = await userService.hasClaimedSocialGift(userId);
            await ctx.editMessageText(getSocialGiftMessage(hasClaimed), {
                parse_mode: 'Markdown',
                reply_markup: getSocialGiftKeyboard(hasClaimed),
                disable_web_page_preview: true
            });
        } catch (err) {
            console.error('❌ Error in social_gift_cancel:', err);
            await safeAnswerCbQuery(ctx, 'Произошла ошибка');
        }
    });

    // 7. Middleware для текстовых ответов FSM
    bot.use(async (ctx, next) => {
        if (!ctx.message?.text || !ctx.session?.waitingFor?.startsWith('social_gift_')) {
            return await next();
        }

        const text = ctx.message.text.trim();
        const state = ctx.session.waitingFor;
        const isSkip = ['пропустить', 'skip', '-', 'нет'].includes(text.toLowerCase());

        ctx.session.socialLead = ctx.session.socialLead || {};

        if (state === 'social_gift_instagram') {
            ctx.session.socialLead.instagram_handle = isSkip ? null : text;
            ctx.session.waitingFor = 'social_gift_youtube';
            await showYouTubePrompt(ctx);
            return;
        }

        if (state === 'social_gift_youtube') {
            ctx.session.socialLead.youtube_handle = isSkip ? null : text;
            await completeSocialGiftClaim(ctx);
            return;
        }

        return await next();
    });
}
