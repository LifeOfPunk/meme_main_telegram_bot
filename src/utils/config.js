export const ADMINS = [1323534384, 1916527652];

// Пакеты генераций
export const PACKAGES = {
    single: {
        title: '1 видео',
        emoji: '🎬',
        generations: 1,
        usdt: 6.2,
        rub: 500,
        stars: 100,
        offerIdLava: '536aaf04-481a-456d-bc8f-3569757ef25f'
    },
    pack_5: {
        title: '5 видео',
        emoji: '📦',
        generations: 5,
        usdt: 27.9,
        rub: 2250,
        stars: 500,
        discount: '10%',
        offerIdLava: 'f9e490bf-dae3-44b1-8897-691bd60650af'
    },
    pack_10: {
        title: '10 видео',
        emoji: '🎁',
        generations: 10,
        usdt: 52.7,
        rub: 4250,
        stars: 1000,
        discount: '15%',
        offerIdLava: 'b1b89b1d-76b7-44f2-a09c-290b74a4abd8'
    },
    pack_50: {
        title: '50 видео',
        emoji: '💎',
        generations: 50,
        usdt: 61.2,
        rub: 5000,
        stars: 5000,
        discount: '20%',
        offerIdLava: '9b19dfbe-2d5c-48f8-b885-0cb526d6de7c'
    }
};

// Поддерживаемые криптовалюты (из оригинального бота)
export const SUPPORTED_CRYPTO = {
    USDT: [
        { name: 'USDT (ERC20)', processing: 'USDT (ERC20)', chainName: 'Ethereum Mainnet' },
        { name: 'USDT (TRC20)', processing: 'USDT (TRC20)', chainName: 'Tron' },
        { name: 'USDT (BEP20)', processing: 'USDT (BEP20)', chainName: 'Binance Smart Chain' },
        { name: 'USDT (POLYGON)', processing: 'USDT (POLYGON)', chainName: 'Polygon' },
        { name: 'USDT (ARB)', processing: 'USDT (ARB1)', chainName: 'Arbitrum One' },
        { name: 'USDT (TON)', processing: 'USDT (TON)', chainName: 'TON' }
    ],
    USDC: [
        { name: 'USDC (ERC20)', processing: 'USDC (ERC20)', chainName: 'Ethereum Mainnet' },
        { name: 'USDC (BEP20)', processing: 'USDC (BEP20)', chainName: 'Binance Smart Chain' },
        { name: 'USDC (POLYGON)', processing: 'USDC (POLYGON)', chainName: 'Polygon' },
        { name: 'USDC (BASE)', processing: 'USDC (BASE)', chainName: 'Base' }
    ],
    TON: [
        { name: 'TON', processing: 'TON', chainName: 'TON' }
    ]
};

// Настройки бесплатной квоты
export const FREE_QUOTA_PER_USER = parseInt(process.env.FREE_QUOTA_PER_USER || '1');

// Реферальная программа
export const REFERRAL_ENABLED = process.env.REFERRAL_ENABLED === 'true';
export const REFERRAL_BONUS = parseInt(process.env.REFERRAL_BONUS_GENERATIONS || '1');
export const EXPERT_CASHBACK_PERCENT = parseInt(process.env.EXPERT_REFERRAL_CASHBACK_PERCENT || '50');

// Telegram Stars
export const STARS_ENABLED = process.env.STARS_ENABLED === 'true';

// Тексты сообщений
export const MESSAGES = {
    WELCOME: '🎬 Добро пожаловать в MeeMee!\n\nСоздавай персонализированные вирусные видео-мемы с твоим именем!\n\nВыбери действие:',
    
    ABOUT: '📱 О проекте MeeMee\n\nMeeMee — это платформа для создания персонализированных вирусных видео-мемов.\n\n✨ Как это работает:\n1. Выбери понравившийся мем\n2. Введи своё имя и пол\n3. Получи уникальное видео!\n\n💰 Стоимость: 1 видео = 500₽ / 6.2 USDT\n\n📹 Видео создаётся за 1-3 минуты\n⚠️ Сохраняй видео сразу - повторно получить нельзя!\n\n❓ FAQ доступен по кнопке ниже',
    
    MEMES_CATALOG: '�� Доступные мемы\n\nВыбери мем для генерации:',
    
    MEME_SOON: '⏳ Этот мем в разработке\n\nСкоро будет доступен!',
    
    NO_QUOTA: '❌ У вас закончились бесплатные генерации!\n\nКупите пакет генераций чтобы продолжить.',
    
    CHOOSE_PAYMENT: '💳 Выберите способ оплаты:\n\n💵 Карта - оплата российской или международной картой\n💎 Крипта - оплата криптовалютой\n⭐ Stars - оплата звёздами Telegram',
    
    ENTER_NAME: '👤 Введите имя для генерации\n\n⚠️ Внимание: не используйте маты и оскорбления, такие видео не будут сгенерированы!',
    
    CHOOSE_GENDER: '🚻 Выберите пол персонажа:',
    
    CONFIRM_GENERATION: (name, gender) => `✅ Проверьте данные:\n\nИмя: ${name}\nПол: ${gender === 'male' ? 'Мальчик' : 'Девочка'}\n\nВсё верно?`,
    
    GENERATION_STARTED: '⏳ Видео создаётся...\n\nОжидайте, это займёт 1-3 минуты.\n\n💡 Совет: после получения сразу сохраните видео!',
    
    GENERATION_SUCCESS: '✅ Ваше видео готово!\n\n⚠️ ВАЖНО: Сохраните видео прямо сейчас!\nЕсли переписка будет потеряна, видео не восстановится.',
    
    GENERATION_FAILED: '❌ Не удалось сгенерировать видео\n\nПопробуйте ещё раз. Ваша генерация не была списана.',
    
    PAYMENT_SUCCESS: '✅ Оплата прошла успешно!\n\nНа ваш баланс добавлены генерации.\n\nХотите запустить генерацию сейчас?',
    
    REFERRAL_INFO: '🎁 Приведи друга за бонус\n\nПолучи +1 бесплатную генерацию за каждого приведённого друга!\n\nТвоя реферальная ссылка:',
    
    EXPERT_REFERRAL_INFO: (percent) => `💼 Реферальная программа для экспертов\n\nПолучай ${percent}% с каждой оплаты пользователя!\n\nТвоя реферальная ссылка:`,
    
    PAYMENT_CANCELLED: (wallet, amount) => {
        const masked = wallet.length > 8 ? `${wallet.slice(0, 4)}...${wallet.slice(-4)}` : wallet;
        return `⏰ Время оплаты истекло\n\nНе переводите средства (${amount} USDT) на кошелек ${masked}\n\nВыберите другой способ оплаты.`;
    },

    PROFILE: (user, generations, referralStats) => {
        let message = `👤 Личный кабинет\n\n`;
        message += `🆔 ID: ${user.userId}\n`;
        message += `📝 Имя: ${user.firstName || 'не указано'}\n\n`;
        
        // Баланс генераций (суммируем бесплатные и платные)
        const availableFree = user.free_quota || 0;
        const availablePaid = user.paid_quota || 0;
        const totalGenerations = availableFree + availablePaid;
        const walletBalance = Number(user.wallet_balance_usdt || 0).toFixed(2);
        
        message += `📊 Баланс генераций: ${totalGenerations} видео\n`;
        message += `🎁 Бесплатные генерации: ${availableFree}\n`;
        message += `💎 Платные генерации: ${availablePaid}\n`;
        message += `💵 Баланс кошелька: ${walletBalance} USDT\n\n`;
        
        // Добавляем реферальную статистику
        if (referralStats) {
            if (referralStats.referredUsers > 0 || referralStats.expertReferrals > 0) {
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
                message += '\n';
            }
        }
        
        // ЗАКОММЕНТИРОВАНО: Последние генерации
        // if (generations && generations.length > 0) {
        //     message += `🎬 Последние генерации:\n`;
        //     const recent = generations.slice(0, 5);
        //     recent.forEach((gen, idx) => {
        //         const statusEmoji = gen.status === 'done' ? '✅' : gen.status === 'failed' ? '❌' : '⏳';
        //         const date = new Date(gen.createdAt).toLocaleDateString('ru-RU');
        //         message += `${idx + 1}. ${statusEmoji} ${gen.memeName} (${date})\n`;
        //     });
        // }
        
        return message;
    },

    CHOOSE_PACKAGE: '💳 Выберите пакет генераций:\n\n📦 Чем больше пакет - тем выгоднее цена за одно видео!'
};

// Клавиатуры
export const KEYBOARDS = {
    MAIN_MENU: {
        inline_keyboard: [
            [{ text: '🎬 Доступные мемы', callback_data: 'catalog' }],
            [{ text: '💳 Купить видео', callback_data: 'buy' }],
            [{ text: '👤 Личный кабинет', callback_data: 'profile' }],
            [{ text: '🎁 Приведи друга', callback_data: 'referral' }],
            [{ text: 'ℹ️ О проекте', callback_data: 'about' }]
        ]
    },
    
    BACK_TO_MENU: {
        inline_keyboard: [
            [{ text: '🔙 Главное меню', callback_data: 'main_menu' }]
        ]
    },
    
    PAYMENT_METHODS: {
        inline_keyboard: [
            [{ text: '💵 Карта', callback_data: 'pay_card' }],
            [{ text: '💎 Крипта', callback_data: 'pay_crypto' }],
            [{ text: '⭐ Stars (скоро)', callback_data: 'pay_stars' }],
            [{ text: '🔙 Назад', callback_data: 'main_menu' }]
        ]
    },
    
    GENDER_CHOICE: {
        inline_keyboard: [
            [{ text: '👦 Мальчик', callback_data: 'gender_male' }],
            [{ text: '👧 Девочка', callback_data: 'gender_female' }],
            [{ text: '🔙 Назад', callback_data: 'catalog' }]
        ]
    },
    
    CONFIRM_GENERATION: {
        inline_keyboard: [
            [{ text: '✅ Всё ок, генерировать!', callback_data: 'confirm_gen' }],
            [{ text: '🔙 Назад', callback_data: 'catalog' }]
        ]
    }
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
        [{ text: '📺 YouTube канал', url: 'https://youtube.com/@aiviral-media' }],
        [{ text: '❓ FAQ', url: 'https://telegra.ph/MeeMee-FAQ-chasto-zadavaemye-voprosy-11-04' }],
        [{ text: '💬 Обратная связь', url: `https://t.me/${process.env.SUPPORT_USERNAME || 'support'}` }],
        [{ text: '🔙 Назад', callback_data: 'main_menu' }]
    ]
};
