export const ADMINS = [1323534384, 1916527652,583561687];

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



// Настройки бесплатной квоты
export const FREE_QUOTA_PER_USER = parseInt(process.env.FREE_QUOTA_PER_USER || '1');

// Реферальная программа
export const REFERRAL_ENABLED = process.env.REFERRAL_ENABLED === 'true';
export const REFERRAL_BONUS = parseInt(process.env.REFERRAL_BONUS_GENERATIONS || '1');
export const EXPERT_CASHBACK_PERCENT = parseInt(process.env.EXPERT_REFERRAL_CASHBACK_PERCENT || '50');

// Telegram Stars
export const STARS_ENABLED = process.env.STARS_ENABLED === 'true';

// Поддерживаемые криптовалюты (точные названия из 0xProcessing)
export const SUPPORTED_CRYPTO = {
    USDT: [
        { name: 'USDT (SOL)', processing: 'USDT (SOL)', chainName: 'Solana' },
        { name: 'USDT (BEP20)', processing: 'USDT (BEP20)', chainName: 'Binance Smart Chain' },
        { name: 'USDT (TON)', processing: 'USDT (TON)', chainName: 'TON' }
    ],
    USDC: [
        { name: 'USDC (SOL)', processing: 'USDC (SOL)', chainName: 'Solana' },
        { name: 'USDC (BEP20)', processing: 'USDC (BEP20)', chainName: 'Binance Smart Chain' }
    ],
    TON: [
        { name: 'TON', processing: 'TON', chainName: 'TON' }
    ]
};

// Тексты сообщений
export const MESSAGES = {
    WELCOME: `*ЧТО ЭТОТ БОТ МОЖЕТ ДЕЛАТЬ?*

🦄 *Создай вирусный мем с своим именем!*

Привет!👋 Меня зовут Maa

В этом боте ты можешь создать свой собственный мем, который залетит на миллион просмотров!

👇 *Нажми START, чтобы начать*`,
    
    MAIN_MENU: `🎬 Добро пожаловать в ViralApp!

Создай вирусный персонализированный мем или видео с твоим именем.

Выбери действие:`,
    
    ABOUT: `📱 О проекте ViralApp (AIVIRAL)

ViralApp — это платформа для создания вирусных видео с помощью генеративного ИИ.

✨ Как это работает:
1. Выбери понравившийся шаблон или введи свой текст
2. Получи уникальное видео!

📹 Видео создаётся за 1-3 минуты
⚠️ Сохраняй видео сразу - повторно получить нельзя!

❓ FAQ доступен по кнопке ниже`,
    
    MEMES_CATALOG: '🎬 Создание видео\nВыберите способ создания видео:',
    
    MEME_SOON: '⏳ Этот мем в разработке\n\nСкоро будет доступен!',
    
    NO_QUOTA: '🎬 Чтобы сгенерировать видео, вам нужно их сначала купить, и после этого вы сможете уже генерировать новые видео.',
    
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
    
    PAYMENT_CARD_CONFIRM: (pkg) => `Сумма к оплате:

${pkg.emoji} ${pkg.title} $${pkg.usdt} (${pkg.rub}₽)

Проводя оплату вы соглашаетесь с договором-оферта и политикой конфиденциальности`,

    PAYMENT_CRYPTO_SELECT: (pkg) => `💎 Оплата криптовалютой

🎬 ${pkg.title}: ${pkg.usdt} USDT

Выберите криптовалюту:`,

    PAYMENT_CRYPTO_NETWORK: (pkg, crypto) => `🎬 ${pkg.title}: ${pkg.usdt} USDT

Выберите сеть для ${crypto}:`,

    PAYMENT_STARS_INFO: 'Оплачивай звездами любимые услуги внутри телеграм!',
    
    CREATE_VIDEO_MENU: `🎬 Создание видео по вашему описанию

📝 Опишите сцену, которую вы хотите увидеть в видео. Чем детальнее описание, тем лучше результат!

Примеры хороших описаний:
• "Кот в очках и галстуке работает за ноутбуком в офисе"
• "Космонавт гуляет по Марсу с собакой, красные скалы и пыльная буря"
• "Робот-повар готовит пиццу на кухне будущего"

👉 [Подробная инструкция](https://telegra.ph/KAK-PISAT-PROMTY-11-28)`,

    CUSTOM_PROMPT_INFO: `🎬 Создание видео по вашему описанию

📝 Опишите сцену, которую вы хотите увидеть в видео. Чем детальнее описание, тем лучше результат!

Примеры хороших описаний:
• "Кот в очках и галстуке работает за ноутбуком в офисе"
• "Космонавт гуляет по Марсу с собакой, красные скалы и пыльная буря"
• "Робот-повар готовит пиццу на кухне будущего"`,

    CUSTOM_PROMPT_INPUT: '🎬 Создание видео: Напишите ваш промт ниже.',

    PROFILE: (user, generations, referralStats) => {
        let message = `👤 Личный кабинет\n\n`;
        message += `🆔 ID: ${user.userId}\n`;
        message += `📝 Имя: ${user.firstName || 'не указано'}\n\n`;
        
        // Баланс генераций
        const availableFree = user.free_quota || 0;
        const availablePaid = user.paid_quota || 0;
        
        message += `🎬 Баланс генераций:\n`;
        message += `├─ 🎁 Доступно бесплатных: ${availableFree}\n`;
        message += `└─ 💎 Доступно платных: ${availablePaid}\n\n`;
        
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
        [{ text: '📺 YouTube Канал', url: 'https://youtube.com/@aiviral-media' }],
        [{ text: '❓ FAQ', url: 'https://telegra.ph/MeeMee-FAQ-chasto-zadavaemye-voprosy-11-04' }],
        [{ text: '🙊 Обратная связь', url: `https://t.me/${process.env.SUPPORT_USERNAME || 'i_prokhorovich'}` }],
        [{ text: '🔙 Главное меню', callback_data: 'main_menu' }]
    ]
};

export const WATERMARK_IMAGE_PATH = process.env.WATERMARK_IMAGE_PATH || '/home/aiviral/memememe/2568-11-12_16.23.25-removebg-preview.png';
