const envAdmins = process.env.ADMINS ? process.env.ADMINS.split(',').map(id => parseInt(id.trim(), 10)).filter(Boolean) : [];
export const ADMINS = Array.from(new Set([1916527652, 7937165663, ...envAdmins]));

// Пакеты генераций
export const PACKAGES = {
    pack_10: {
        title: '10 видео',
        emoji: '🎬',
        generations: 10,
        usdt: 6.2,
        rub: 500,
        stars: 100,
        offerIdLava: '4729f451-8d5f-4203-bf40-2ef98213fcae'
    },
    pack_50: {
        title: '50 видео',
        emoji: '📦',
        generations: 50,
        usdt: 27.9,
        rub: 2250,
        stars: 500,
        discount: '10%',
        offerIdLava: 'f9e490bf-dae3-44b1-8897-691bd60650af'
    },
    pack_100: {
        title: '100 видео',
        emoji: '🎁',
        generations: 100,
        usdt: 52.7,
        rub: 4250,
        stars: 1000,
        discount: '15%',
        offerIdLava: 'b1b89b1d-76b7-44f2-a09c-290b74a4abd8'
    },
    pack_500: {
        title: '500 видео',
        emoji: '💎',
        generations: 500,
        usdt: 248,
        rub: 20000,
        stars: 5000,
        discount: '20%',
        offerIdLava: '0cafa646-d2af-44d1-9c89-89372ff1102f'
    }
};



// Стоимость генерации видео (Google Gemini Omni Flash 1.1: 10s = 126 кредитов = $0.63, розница 1.30 USDT)
export const BASE_COST = 0.63;
export const MULTIPLIER = 2.0;
export const GENERATION_COST_USDT = 1.30;

// Настройки бесплатной квоты
export const FREE_QUOTA_PER_USER = parseInt(process.env.FREE_QUOTA_PER_USER || '1');

// Реферальная программа
export const REFERRAL_ENABLED = process.env.REFERRAL_ENABLED === 'true';
export const REFERRAL_BONUS = parseInt(process.env.REFERRAL_BONUS_GENERATIONS || '1');
export const EXPERT_CASHBACK_PERCENT = parseInt(process.env.EXPERT_REFERRAL_CASHBACK_PERCENT || '50');

// Telegram Stars
export const STARS_ENABLED = process.env.STARS_ENABLED === 'true';

// Поддерживаемые криптовалюты (точные названия из 0xProcessing)
// 1-шаговый выбор сетей: TON, USDT (BEP20), USDT (SOL), BNB (BEP20)
export const SUPPORTED_CRYPTO = [
    { id: 'TON', name: '💎 TON (Gram)', processing: 'TON', chainName: 'TON' },
    { id: 'USDT_BEP20', name: '⚡ USDT (BEP20)', processing: 'USDT (BEP20)', chainName: 'Binance Smart Chain' },
    { id: 'USDT_SOL', name: '🟣 USDT (SOL)', processing: 'USDT (SOL)', chainName: 'Solana' },
    { id: 'BNB_BEP20', name: '🟡 BNB (BEP20)', processing: 'BNB', chainName: 'Binance Smart Chain' }
];

// Для обратной совместимости
SUPPORTED_CRYPTO.TON = [{ name: '💎 TON (Gram)', processing: 'TON', chainName: 'TON' }];
SUPPORTED_CRYPTO.USDT = [
    { name: '⚡ USDT (BEP20)', processing: 'USDT (BEP20)', chainName: 'Binance Smart Chain' },
    { name: '🟣 USDT (SOL)', processing: 'USDT (SOL)', chainName: 'Solana' }
];
SUPPORTED_CRYPTO.BNB = [{ name: '🟡 BNB (BEP20)', processing: 'BNB', chainName: 'Binance Smart Chain' }];

// Тексты сообщений
export const MESSAGES = {
    WELCOME: `*Добро пожаловать в ViralApp!*

🚀 *Создавай вирусные персонализированные видео за 60 секунд!*

В этом боте ты можешь сгенерировать свой собственный трендовый ролик с твоим именем или по любому описанию.

👇 *Нажми кнопку ниже, чтобы начать:*`,
    
    MAIN_MENU: `🎬 Добро пожаловать в ViralApp!

Создай вирусный персонализированный мем или видео с твоим именем.

Выбери действие:`,
    
    ABOUT: `📱 О проекте ViralApp (AIVIRAL)

ViralApp — это платформа для создания вирусных видео с помощью генеративного ИИ.

✨ Как это работает:
1. Выбери шаблон или напиши свой промпт
2. Получи уникальное видео в лучшем качестве!
3. Обязательно сохраняй готовое видео на телефон — после перезапуска бота или очистки кеша файл может быть недоступен.`,
    
    MEMES_CATALOG: '🎬 Создание видео\nВыберите способ создания видео:',
    
    MEME_SOON: '⏳ Этот мем в разработке\n\nСкоро будет доступен!',
    
    NO_BALANCE: '🎬 Вы пока не можете генерировать видео, так как у вас недостаточно средств на балансе.\n\nЧтобы создавать видео, пополните баланс удобным способом:',
    
    NO_QUOTA: '🎬 Вы пока не можете генерировать видео, так как у вас недостаточно средств на балансе.\n\nЧтобы создавать видео, пополните баланс удобным способом:',
    
    CHOOSE_PACKAGE: '💎 Выберите пакет генераций:\n\nВыберите подходящий пакет для создания видео:',
    
    CHOOSE_PAYMENT: (pkg) => {
        const pricePerVideo = (pkg.rub / pkg.generations).toFixed(2);
        const usdtPerVideo = (pkg.usdt / pkg.generations).toFixed(2);
        return `🎬 ${pkg.title}
💎 Генераций: ${pkg.generations}
💰 Цена: ${pkg.rub}₽ (${pkg.usdt} USDT)
📊 Цена за 1 видео: ${pricePerVideo}₽ (${usdtPerVideo} USDT)

Выберите способ оплаты:`;
    },
    
    ENTER_NAME: `👤 Введите имя ниже для генерации:

⚠️ Внимание: не используйте маты и оскорбления, такие видео не будут сгенерированы.`,
    
    CHOOSE_GENDER: 'Какой ваш пол?',
    
    CONFIRM_GENERATION: (name, gender) => `Имя ${name} верно начинаю генерацию`,
    
    GENERATION_STARTED: (memeName) => {
        if (memeName) {
            return `⏳ Начинаю генерацию видео по шаблону промпта ${memeName}...\n\n💡 Идет генерация\n\nОжидайте, это займёт 1-3 минуты.\n\n💡 Совет: после получения сразу сохраните видео!`;
        }
        return `⏳ Начинаю генерацию видео по вашему промпту...\n\n💡 Идет генерация\n\nОжидайте, это займёт 1-3 минуты.\n\n💡 Совет: после получения сразу сохраните видео!`;
    },
    
    GENERATION_SUCCESS: `✅ Ваше видео готово!

🎬 Генерация успешно завершена!

⚠️ ВАЖНО: Сохраните видео прямо сейчас!`,
    
    PROMPT_GUIDE: `🎬 КАК ПИСАТЬ ПРОМТЫ

🧩 1. Место - Где происходит сцена?
Русский: ночной клуб, лес, пляж, мансарда

👥 2. Герои - Кто в кадре и как выглядит?
Русский: мужчина с длинными тёмными волосами, похожий на Иисуса, люди в костюмах животных

🔄 3. Действие - Что происходит, как двигается камера?
Русский: камера движется сквозь толпу, танцующих людей, дым и огни

🌈 4. Атмосфера - Какой стиль и настроение?
Русский: кинематографический, 4K, неоновый свет, замедленная съемка, драматическая атмосфера

⚡ Пример:
Русский: Кинематографическая техно-вечеринка в лофте, люди и животные танцуют под теплым светом, диджей в центре, камера медленно движется сквозь дым, качество 4K

💡 Советы:
• Каждый промт = одна сцена
• До 1000 символов
• Без насилия, эротики и политики
• Чем точнее описание — тем круче видео!`,
    
    GENERATION_FAILED: 'Упс, произошла ошибка, со стороны нейронки! Попробуйте еще раз.❤️',
    
    PAYMENT_SUCCESS: 'Ваша оплата успешно прошла! ✅',
    
    REFERRAL_INFO: '🎁 Приведи друга за бонус и получи +1 генерацию в подарок!\n\nТвоя реферальная ссылка:',
    
    EXPERT_REFERRAL_INFO: (stats) => `💼 Реферальная программа для экспертов

Получай 25% с первой линии и 10% со второй каждой оплаты пользователей!

Твоя реферальная ссылка:`,
    
    PAYMENT_CANCELLED: (wallet, amount) => {
        const masked = wallet.length > 8 ? `${wallet.slice(0, 4)}...${wallet.slice(-4)}` : wallet;
        return `You did not complete the payment within 30 minutes. Do not transfer funds using the Video to the wallet ${masked}

Instead, choose another payment method.`;
    },
    
    EMAIL_REQUEST: (pkg) => `💳 Оплата картой

${pkg.emoji} ${pkg.title}

Введите ваш email для получения чека:`,

    EMAIL_INVALID: 'Упс вы ввели не правильную почту! Введите правильно, чтобы мы могли отправить вам сообщение о оплате.',
    
    PAYMENT_CARD_CONFIRM: (pkg, dynamicUsd = null, dynamicGenerations = null) => {
        const usdFormatted = dynamicUsd ? Number(dynamicUsd).toFixed(2) : Number(pkg.usdt).toFixed(2);
        const gensCount = dynamicGenerations !== null ? dynamicGenerations : Math.floor(Number(usdFormatted) / GENERATION_COST_USDT);
        return `💳 <b>Оплата банковской картой</b>\n\n` +
            `💰 <b>Сумма к оплате:</b> ${pkg.rub}₽ (~${usdFormatted}$)\n` +
            `🎬 <b>Стоимость генерации:</b> ${GENERATION_COST_USDT.toFixed(2)}$\n` +
            `💎 <b>Количество генераций:</b> ${gensCount} видео\n\n` +
            `Проводя оплату, вы соглашаетесь с <a href="https://aiviral.agency/dogovor-oferta/">Договором-офертой</a> и <a href="https://aiviral.agency/politika-konfidencialnosti/">Политикой конфиденциальности</a>.\n\n` +
            `👇 Нажмите кнопку «Оплатить картой» для перехода на защищенную страницу оплаты:`;
    },

    PAYMENT_CRYPTO_SELECT: (pkg) => `💎 Оплата криптовалютой

🎬 ${pkg.title}: ${pkg.usdt} USDT

Выберите сеть для оплаты:`,

    PAYMENT_CRYPTO_NETWORK: (pkg, crypto) => `🎬 ${pkg.title}: ${pkg.usdt} USDT

Выберите сеть для ${crypto}:`,

    PAYMENT_STARS_INFO: 'Оплачивай звездами любимые услуги внутри телеграм!',
    
    CREATE_VIDEO_MENU: `🎬 Создание видео по вашему описанию

📝 Опишите сцену, которую вы хотите увидеть в видео. Чем детальнее описание, тем лучше результат!

Примеры хороших описаний:
• "Кот в очках и галстуке работает за ноутбуком в офисе"
• "Космонавт гуляет по Марсу с собакой, красные скалы и пыльная буря"
• "Робот-повар готовит пиццу на кухне будущего"

👉 [Подробная инструкция](https://aiviral.agency/kak-pisat-promty/)`,

    CUSTOM_PROMPT_INFO: `🎬 Создание видео по вашему описанию

📝 Опишите сцену, которую вы хотите увидеть в видео. Чем детальнее описание, тем лучше результат!

Примеры хороших описаний:
• "Кот в очках и галстуке работает за ноутбуком в офисе"
• "Космонавт гуляет по Марсу с собакой, красные скалы и пыльная буря"
• "Робот-повар готовит пиццу на кухне будущего"`,

    CUSTOM_PROMPT_INPUT: '🎬 Создание видео: Напишите ваш промт ниже.',

    PROFILE: (user, generations, referralStats) => {
        const userData = typeof user === 'object' && user !== null ? user : { userId: user };
        let message = `👤 Личный кабинет\n\n`;
        message += `🆔 ID: ${userData.userId || userData.id || 'не указан'}\n`;
        message += `📝 Имя: ${userData.firstName || 'не указано'}\n\n`;
        
        // Баланс генераций (суммируем бесплатные и платные)
        const availableFree = userData.free_quota || 0;
        const availablePaid = userData.paid_quota || 0;
        const walletBalance = Number(userData.wallet_balance_usdt ?? userData.wallet_balance ?? 0).toFixed(2);
        const videosFromWallet = Math.floor(Number(walletBalance) / GENERATION_COST_USDT);
        const totalPaid = availablePaid + videosFromWallet;
        const totalGenerations = availableFree + totalPaid;
        const rawCashback = userData?.totalCashback ?? referralStats?.totalCashback ?? userData?.affiliate_earnings ?? 0;
        const cashbackAmount = Number(rawCashback || 0).toFixed(2);
        
        message += `🎬 Стоимость генерации: ${GENERATION_COST_USDT.toFixed(2)}$\n\n`;
        message += `📊 Ваш баланс генераций: ${totalGenerations} видео\n`;
        message += `🎁 Бесплатные генерации: ${availableFree}\n`;
        message += `💎 Платные генерации: ${totalPaid}\n`;
        message += `💵 Баланс кошелька: ${walletBalance} USDT\n\n`;
        
        if (Number(cashbackAmount) > 0) {
            message += `💰 Доступно к выводу: ${cashbackAmount} USDT\n\n`;
        }
        
        // Добавляем реферальную статистику
        if (referralStats && (referralStats.referredUsers > 0 || referralStats.expertReferrals > 0)) {
            message += `🎁 Реферальная программа:\n`;
            if (referralStats.referredUsers > 0) {
                message += `├─ 👥 Приглашено друзей: ${referralStats.referredUsers}\n`;
            }
            if (referralStats.expertReferrals > 0) {
                message += `├─ 💼 Экспертных рефералов: ${referralStats.expertReferrals}\n`;
                message += `└─ 💰 Заработано: ${referralStats.totalCashback?.toFixed(2) || 0}₽\n`;
            } else if (referralStats.referredUsers > 0) {
                message += `└─ 🎁 Получено бонусов: ${referralStats.referredUsers}\n`;
            }
            message += `\n`;
        }
        return message;
    },
    
    // ...
};

// Клавиатура для главного меню
export const MAIN_MENU_KEYBOARD = {
    inline_keyboard: [
        [{ text: '🎬 Создать видео', callback_data: 'catalog' }],
        [{ text: '💳 Купить видео', callback_data: 'buy' }],
        [{ text: '👤 Личный кабинет', callback_data: 'profile' }],
        [{ text: '🎁 Приведи друга', callback_data: 'referral' }],
        [{ text: 'ℹ️ О проекте', callback_data: 'about' }]
    ]
};

// Клавиатура при нулевом балансе и квотах (TASK-15)
export const NO_BALANCE_KEYBOARD = {
    inline_keyboard: [
        [{ text: '💎 Криптовалюта', callback_data: 'pay_crypto_deposit' }],
        [{ text: '🔙 Главное меню', callback_data: 'main_menu' }]
    ]
};

// Клавиатура для возврата в главное меню
export const BACK_TO_MENU = {
    inline_keyboard: [
        [{ text: '🔙 Главное меню', callback_data: 'main_menu' }]
    ]
};

// Клавиатура для выбора способа оплаты
export const PAYMENT_METHODS = {
    inline_keyboard: [
        [{ text: '💳 Оплата картой', callback_data: 'pay_card' }],
        [{ text: '📝 Оплата криптой', callback_data: 'pay_crypto' }],
        [{ text: '⭐️ Оплата звездами', callback_data: 'pay_stars' }],
        [{ text: '⏪ Вернуться назад', callback_data: 'main_menu' }]
    ]
};

// Клавиатура для выбора пола персонажа
export const GENDER_CHOICE = {
    inline_keyboard: [
        [{ text: '👦🏻 Я мальчик', callback_data: 'gender_male' }],
        [{ text: '🧒🏼 Я девочка', callback_data: 'gender_female' }],
        [{ text: '⏪ Вернуться назад', callback_data: 'catalog' }]
    ]
};

// Клавиатура для подтверждения генерации
export const CONFIRM_GENERATION = {
    inline_keyboard: [
        [{ text: '🚀 Всё верно!', callback_data: 'confirm_gen' }],
        [{ text: '⏪ Ввести имя еще раз', callback_data: 'catalog' }]
    ]
};

// Клавиатура для выбора типа реферальной ссылки
export const REFERRAL_TYPE_KEYBOARD = {
    inline_keyboard: [
        [{ text: '👤 Пользователь (1 бесплатная генерация)', callback_data: 'ref_user' }],
        [{ text: '💼 Эксперт (реферальная программа)', callback_data: 'ref_expert' }],
        [{ text: '🔙 Назад', callback_data: 'main_menu' }]
    ]
};

export const ABOUT_KEYBOARD = {
    inline_keyboard: [
        [{ text: '💬 Поддержка проекта', url: 'https://t.me/aiviral_main' }],
        [{ text: '🔙 В личный кабинет', callback_data: 'profile' }],
        [{ text: '🏠 Главное меню', callback_data: 'main_menu' }]
    ]
};

export function getMainMenuText(user) {
    const freeQuota = user?.free_quota || 0;
    const paidQuota = user?.paid_quota || 0;
    const balanceUsdt = Number(user?.wallet_balance_usdt ?? user?.wallet_balance ?? 0).toFixed(2);
    const videosFromWallet = Math.floor(Number(balanceUsdt) / GENERATION_COST_USDT);
    const totalPaid = paidQuota + videosFromWallet;
    const totalGenerations = freeQuota + totalPaid;

    return `🎬 *Добро пожаловать в ViralApp!*\n\n` +
        `Создай вирусный персонализированный мем или видео в лучшем качестве.\n` +
        `🎬 *Стоимость генерации:* ${GENERATION_COST_USDT.toFixed(2)}$\n\n` +
        `📊 *Ваш баланс генераций:* ${totalGenerations} видео\n` +
        `🎁 Бесплатные генерации: ${freeQuota}\n` +
        `💎 Платные генерации: ${totalPaid}\n` +
        `💵 Баланс кошелька: ${balanceUsdt} USDT\n\n` +
        `Выбери действие:`;
}

export const WATERMARK_IMAGE_PATH = process.env.WATERMARK_IMAGE_PATH || '/home/aiviral/memememe/2568-11-12_16.23.25-removebg-preview.png';
