import { loadActiveMemes } from '../utils/memeLoader.js';
import { UserService } from '../services/User.service.js';

const userService = new UserService();

// Генерация клавиатуры каталога с пагинацией
export function createCatalogKeyboard(page = 0, itemsPerPage = 5) {
    const memes = loadActiveMemes();
    const start = page * itemsPerPage;
    const end = start + itemsPerPage;
    const pageMemes = memes.slice(start, end);
    
    const buttons = pageMemes.map(meme => {
        const emoji = meme.status === 'soon' ? '⏳ ' : '';
        return [{
            text: emoji + meme.name,
            callback_data: `meme_${meme.id}`
        }];
    });
    
    // Кнопки навигации
    const navButtons = [];
    if (page > 0) {
        navButtons.push({
            text: '⬅️ Назад',
            callback_data: `catalog_page_${page - 1}`
        });
    }
    if (end < memes.length) {
        navButtons.push({
            text: '▶️ Следующая страница',
            callback_data: `catalog_page_${page + 1}`
        });
    }
    
    if (navButtons.length > 0) {
        buttons.push(navButtons);
    }

    // Кнопка для перехода в главное меню
    buttons.push([{
        text: '⏪ Вернуться назад',
        callback_data: 'create_video'
    }]);
    
    return { inline_keyboard: buttons };
}

// Генерация клавиатуры для выбора криптовалюты (не используется, логика в paymentController)
export function createCryptoKeyboard(packageKey = 'single') {
    return {
        inline_keyboard: [
            [{ text: '✅ USDT', callback_data: `crypto_USDT_${packageKey}` }],
            [{ text: '✅ TON', callback_data: `crypto_TON_${packageKey}` }],
            [{ text: '⏪ Вернуться назад', callback_data: `select_package_${packageKey}` }]
        ]
    };
}

// Генерация клавиатуры для выбора сети (не используется, логика в paymentController)
export function createChainKeyboard(crypto, chains, packageKey = 'single') {
    const buttons = chains.map(chain => [{
        text: chain.name,
        callback_data: `chain_${crypto}_${chain.processing.replace(/\s+/g, '_')}_${packageKey}`
    }]);
    
    buttons.push([{
        text: '⏪ Вернуться назад',
        callback_data: `pay_crypto_${packageKey}`
    }]);
    
    return { inline_keyboard: buttons };
}

// Генерация клавиатуры для оплаты криптой (TASK-02-03, TASK-15, TASK-20)
export function createPaymentCryptoKeyboard(orderId, packageKey = 'deposit', address = null, paymentUrl = null) {
    const buttons = [];
    
    // Кнопка показа QR-кода по запросу (адрес копируется кликом по тексту в сообщении)
    buttons.push([{ text: '🖼️ Показать QR-код', callback_data: `show_qr_${orderId}` }]);

    if (paymentUrl && typeof paymentUrl === 'string' && paymentUrl.startsWith('http') && !paymentUrl.includes('404')) {
        buttons.push([{ text: '🌐 Страница оплаты', url: paymentUrl }]);
    }
    buttons.push([{ text: '✅ Проверить оплату', callback_data: `check_payment_${orderId}` }]);
    const backCallback = packageKey && packageKey !== 'deposit' ? `select_package_${packageKey}` : 'buy';
    buttons.push([{ text: '🔙 Назад', callback_data: backCallback }]);
    
    return {
        inline_keyboard: buttons
    };
}

// Генерация клавиатуры после успешной оплаты
export function createAfterPaymentKeyboard() {
    return {
        inline_keyboard: [
            [{ text: '🍿 Запустить генерацию сейчас?', callback_data: 'create_video' }],
            [{ text: '⏪ Вернуться в главное меню', callback_data: 'main_menu' }]
        ]
    };
}

// Генерация динамической клавиатуры главного меню
export async function createMainMenuKeyboard(userIdOrUser) {
    let freeQuota = 0;
    if (typeof userIdOrUser === 'object' && userIdOrUser !== null) {
        freeQuota = userIdOrUser.free_quota || 0;
    } else if (typeof userIdOrUser === 'number' && userIdOrUser <= 100 && !Number.isInteger(userIdOrUser / 10000)) {
        // If passed direct quota count
        freeQuota = userIdOrUser;
    } else if (userIdOrUser) {
        const user = await userService.getUser(userIdOrUser);
        freeQuota = user?.free_quota || 0;
    }
    
    const buttons = [];
    
    // Кнопка 1: "🎬 Создать видео" (всегда вверху)
    buttons.push([{
        text: '🎬 Создать видео',
        callback_data: 'create_video'
    }]);

    // Кнопка 2: "🎁 Бесплатная генерация" (только если есть бесплатные генерации)
    if (freeQuota > 0) {
        buttons.push([{
            text: '🎁 Бесплатная генерация',
            callback_data: 'create_video_free'
        }]);
    }
    
    // Кнопка 3: "💳 Пополнить баланс" (целевое действие пополнения)
    buttons.push([{
        text: '💳 Пополнить баланс',
        callback_data: 'buy'
    }]);

    // Кнопка 4: "👤 Личный кабинет"
    buttons.push([{
        text: '👤 Личный кабинет',
        callback_data: 'profile'
    }]);

    // Кнопка 5: "🤝 Реферальная программа"
    buttons.push([{
        text: '🤝 Реферальная программа',
        callback_data: 'referral'
    }]);
    
    return { inline_keyboard: buttons };
}

// Генерация клавиатуры личного кабинета (TASK-07, TASK-15, TASK-20)
export function createProfileKeyboard(user, referralStats = null) {
    const totalCashback = Number(user?.totalCashback ?? referralStats?.totalCashback ?? user?.affiliate_earnings ?? 0);
    const buttons = [];

    // 1. [💸 Вывести средства] -> ПОКАЗЫВАТЬ ТОЛЬКО ЕСЛИ у пользователя есть заработанный кешбэк (totalCashback > 0)
    if (totalCashback > 0) {
        buttons.push([{
            text: '💸 Вывести средства',
            callback_data: 'withdraw'
        }]);
    }

    // 2. [❓ Инструкция] -> https://aiviral.agency/kak-pisat-promty/
    buttons.push([{
        text: '❓ Инструкция',
        url: 'https://aiviral.agency/kak-pisat-promty/'
    }]);

    // 3. [💳 История транзакций]
    buttons.push([{
        text: '💳 История транзакций',
        callback_data: 'profile_transactions'
    }]);

    // 4. [📜 История генераций]
    buttons.push([{
        text: '📜 История генераций',
        callback_data: 'profile_history'
    }]);

    // 5. [💬 Поддержка] -> https://t.me/aiviral_main
    buttons.push([{
        text: '💬 Поддержка',
        url: 'https://t.me/aiviral_main'
    }]);

    // 6. [ℹ️ О проекте] -> открывает экран о проекте
    buttons.push([{
        text: 'ℹ️ О проекте',
        callback_data: 'about'
    }]);

    // 7. [🔙 Главное меню]
    buttons.push([{
        text: '🔙 Главное меню',
        callback_data: 'main_menu'
    }]);
    
    return { inline_keyboard: buttons };
}
