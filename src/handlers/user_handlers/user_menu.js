import { UserService } from '../../services/User.service.js';
import { GenerationService } from '../../services/Generation.service.js';
import { ReferralService } from '../../services/Referral.service.js';
import { MESSAGES } from '../../config.js';
import { createProfileKeyboard, createMainMenuKeyboard } from '../../screens/keyboards.js';

const userService = new UserService();
const generationService = new GenerationService();
const referralService = new ReferralService();

async function safeAnswerCbQuery(ctx, text = null, options = {}) {
    try {
        if (ctx.callbackQuery) {
            await ctx.answerCbQuery(text, options);
        }
    } catch (err) {
        console.log('⚠️ Could not answer cb query:', err.message);
    }
}

export { createProfileKeyboard, createMainMenuKeyboard };

/**
 * Клавиатура пользовательского меню с кнопкой «🎁 Подписывайся за подарок!»
 */
export async function createUserMenuKeyboard(userId) {
    return await createMainMenuKeyboard(userId);
}

/**
 * Обработчик экрана профиля / личного кабинета (TASK-07 / TASK-10)
 * Включает кнопку «🎁 Подписывайся за подарок!» для перехода к сбору бонусов за соцсети
 */
export async function handleProfile(ctx) {
    try {
        await safeAnswerCbQuery(ctx);
        
        const userId = ctx.from?.id;
        if (!userId) return;
        
        const user = await userService.getUser(userId);
        if (!user) {
            return await safeAnswerCbQuery(ctx, 'Ошибка загрузки профиля', { show_alert: true });
        }
        
        const generations = await generationService.getUserGenerations(userId);
        const referralStats = await referralService.getReferralStats(userId);
        
        const message = MESSAGES.PROFILE(user, generations, referralStats);
        const keyboard = createProfileKeyboard(user, referralStats);
        
        try {
            await ctx.editMessageText(message, {
                reply_markup: keyboard
            });
        } catch (editErr) {
            await ctx.reply(message, {
                reply_markup: keyboard
            });
        }
    } catch (err) {
        console.error('❌ Error in handleProfile:', err);
        await safeAnswerCbQuery(ctx, 'Произошла ошибка');
    }
}

/**
 * Обработчик вывода средств (TASK-15)
 */
export async function handleWithdraw(ctx) {
    try {
        await safeAnswerCbQuery(ctx);
        const userId = ctx.from?.id;
        if (!userId) return;

        const user = await userService.getUser(userId);
        const referralStats = await referralService.getReferralStats(userId);
        const rawAmount = user?.totalCashback ?? referralStats?.totalCashback ?? user?.affiliate_earnings ?? 0;
        const amount = Number(rawAmount || 0).toFixed(2);

        const text = `💼 Вывод реферального вознаграждения от $5.00 осуществляется через менеджера.\n\nВаш доступный кешбэк: ${amount} USDT\n\nДля выплаты напишите нашему менеджеру: @aiviral_main`;

        const keyboard = {
            inline_keyboard: [
                [{ text: '💬 Написать менеджеру', url: 'https://t.me/aiviral_main' }],
                [{ text: '🔙 Назад в профиль', callback_data: 'profile' }]
            ]
        };

        try {
            await ctx.editMessageText(text, { reply_markup: keyboard });
        } catch (editErr) {
            await ctx.reply(text, { reply_markup: keyboard });
        }
    } catch (err) {
        console.error('❌ Error in handleWithdraw:', err);
        await safeAnswerCbQuery(ctx, 'Произошла ошибка');
    }
}

/**
 * Обработчик пользовательского меню
 */
export async function handleUserMenu(ctx) {
    try {
        await safeAnswerCbQuery(ctx);
        const userId = ctx.from?.id;
        if (!userId) return;

        const keyboard = await createUserMenuKeyboard(userId);
        const menuText = MESSAGES?.MAIN_MENU || '🎬 Главное меню:';

        try {
            await ctx.editMessageText(menuText, { reply_markup: keyboard });
        } catch (err) {
            await ctx.reply(menuText, { reply_markup: keyboard });
        }
    } catch (err) {
        console.error('❌ Error in handleUserMenu:', err);
        await safeAnswerCbQuery(ctx, 'Произошла ошибка');
    }
}

/**
 * Регистрация обработчиков меню пользователя
 */
export function registerUserMenuHandlers(bot) {
    bot.command('menu', handleUserMenu);
    bot.action('user_menu', handleUserMenu);
    bot.command('profile', handleProfile);
    bot.action('profile', handleProfile);
    bot.action('withdraw', handleWithdraw);
}
