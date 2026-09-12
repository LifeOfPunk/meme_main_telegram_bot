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

// Генерация клавиатуры для оплаты криптой
export function createPaymentCryptoKeyboard(orderId, packageKey = 'single', paymentUrl = null) {
    const buttons = [];
    
    if (paymentUrl) {
        buttons.push([{ text: '🌐 Страница оплаты (QR / Ссылка)', url: paymentUrl }]);
    }
    buttons.push([{ text: '🔄 Проверить оплату', callback_data: `check_payment_${orderId}` }]);
    buttons.push([{ text: '🔙 Назад к пакетам', callback_data: `select_package_${packageKey}` }]);
    
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
export async function createMainMenuKeyboard(userId) {
    const user = await userService.getUser(userId);
    const freeQuota = user?.free_quota || 0;
    const paidQuota = user?.paid_quota || 0;
    
    const buttons = [];
    
    // Кнопка 1: "🎁 Бесплатная генерация" (только если есть бесплатные генерации)
    if (freeQuota > 0) {
        buttons.push([{
            text: '🎁 Бесплатная генерация',
            callback_data: 'create_video_free'
        }]);
    }

    // Кнопка 2: "🎬 Сгенерировать видео" (всегда присутствует)
    if (paidQuota > 0) {
        buttons.push([{
            text: '🎬 Сгенерировать видео',
            callback_data: 'create_video_paid'
        }]);
    } else {
        buttons.push([{
            text: '🎬 Сгенерировать видео',
            callback_data: 'buy'
        }]);
    }
    
    // Кнопки личного кабинета и подарка за подписку на соцсети
    buttons.push(
        [{ text: '👤 Личный кабинет', callback_data: 'profile' }],
        [{ text: '🎁 Подписывайся за подарок!', callback_data: 'social_gift' }]
    );
    
    return { inline_keyboard: buttons };
}

// Генерация клавиатуры личного кабинета (TASK-07)
export function createProfileKeyboard(user) {
    const freeQuota = user?.free_quota || 0;
    const buttons = [];
    
    // Кнопка «🎁 Бесплатная генерация» (если free > 0)
    if (freeQuota > 0) {
        buttons.push([{
            text: '🎁 Бесплатная генерация',
            callback_data: 'create_video_free'
        }]);
    }
    
    // «💳 Купить видео», «📜 История генераций», «🔙 Главное меню»
    buttons.push([{
        text: '💳 Купить видео',
        callback_data: 'buy'
    }]);
    buttons.push([{
        text: '📜 История генераций',
        callback_data: 'profile_history'
    }]);
    buttons.push([{
        text: '🔙 Главное меню',
        callback_data: 'main_menu'
    }]);
    
    return { inline_keyboard: buttons };
}
