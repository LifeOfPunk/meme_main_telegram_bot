import { MESSAGES, PACKAGES, SUPPORTED_CRYPTO, REFERRAL_ENABLED, REFERRAL_TYPE_KEYBOARD, ABOUT_KEYBOARD } from '../config.js';
import { createCryptoKeyboard, createChainKeyboard, createPaymentCryptoKeyboard, createAfterPaymentKeyboard, createMainMenuKeyboard } from '../screens/keyboards.js';
import { PaymentCryptoService } from '../services/PaymentCrypto.service.js';
import { PaymentFiatService } from '../services/PaymentFiat.service.js';
import { UserService } from '../services/User.service.js';
import { OrderService } from '../services/Order.service.js';
import { ReferralService } from '../services/Referral.service.js';
import { GenerationService } from '../services/Generation.service.js';

const paymentCryptoService = new PaymentCryptoService();
const paymentFiatService = new PaymentFiatService();
const userService = new UserService();
const orderService = new OrderService();
const referralService = new ReferralService();
const generationService = new GenerationService();

// Безопасный ответ на callback query (игнорирует ошибку "query is too old")
async function safeAnswerCbQuery(ctx, text = null) {
    try {
        if (text) {
            await ctx.answerCbQuery(text);
        } else {
            await ctx.answerCbQuery();
        }
    } catch (error) {
        if (error.description && error.description.includes('query is too old')) {
            console.log('⚠️ Query is too old, ignoring...');
        } else {
            console.error('❌ Error in answerCbQuery:', error);
        }
    }
}

// Обработчик "Купить видео"
export async function handleBuy(ctx) {
    try {
        await safeAnswerCbQuery(ctx); // Убираем индикатор загрузки
        
        // Создаём кнопки для всех пакетов
        const packageButtons = Object.keys(PACKAGES).map(key => {
            const pkg = PACKAGES[key];
            const discount = pkg.discount ? ` 🔥 -${pkg.discount}` : '';
            return [{
                text: `${pkg.emoji} ${pkg.title} - ${pkg.rub}₽${discount}`,
                callback_data: `select_package_${key}`
            }];
        });
        
        await ctx.editMessageText(MESSAGES.CHOOSE_PACKAGE, {
            reply_markup: {
                inline_keyboard: [
                    ...packageButtons,
                    [{ text: '🔙 Назад', callback_data: 'main_menu' }]
                ]
            }
        });
    } catch (err) {
        console.error('❌ Error in handleBuy:', err);
        await safeAnswerCbQuery(ctx, 'Произошла ошибка');
    }
}

// Обработчик выбора пакета
export async function handleSelectPackage(ctx, packageKey) {
    try {
        await safeAnswerCbQuery(ctx); // Убираем индикатор загрузки
        
        const pkg = PACKAGES[packageKey];
        if (!pkg) {
            return await safeAnswerCbQuery(ctx, 'Пакет не найден', { show_alert: true });
        }
        
        // Сохраняем выбранный пакет в сессии
        ctx.session = ctx.session || {};
        ctx.session.selectedPackage = packageKey;
        
        const message = MESSAGES.CHOOSE_PAYMENT(pkg);
        
        // Формируем кнопки оплаты в зависимости от настроек
        const paymentButtons = [];
        
        if (process.env.CARD_ENABLED === 'true') {
            paymentButtons.push([{ text: '💳 Карта', callback_data: `pay_card_${packageKey}` }]);
        }
        
        if (process.env.CRYPTO_ENABLED === 'true') {
            paymentButtons.push([{ text: '💎 Крипта', callback_data: `pay_crypto_${packageKey}` }]);
        }
        
        if (process.env.STARS_ENABLED === 'true') {
            paymentButtons.push([{ text: '⭐️ Оплата звездами', callback_data: `pay_stars_${packageKey}` }]);
        }
        
        paymentButtons.push(
            [{ text: '🔙 Назад', callback_data: 'buy' }]
        );
        
        // Проверяем есть ли текст в сообщении (если это фото, то текста нет)
        try {
            await ctx.editMessageText(message, {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: paymentButtons
                }
            });
        } catch (editErr) {
            // Если не удалось отредактировать (например, это фото), удаляем и отправляем новое
            if (editErr.description && editErr.description.includes('no text in the message')) {
                await ctx.deleteMessage().catch(() => {});
                await ctx.reply(message, {
                    parse_mode: 'Markdown',
                    reply_markup: {
                        inline_keyboard: paymentButtons
                    }
                });
            } else {
                throw editErr;
            }
        }
    } catch (err) {
        console.error('❌ Error in handleSelectPackage:', err);
        await safeAnswerCbQuery(ctx, 'Произошла ошибка');
    }
}

// Обработчик оплаты картой
export async function handlePayCard(ctx, packageKey = 'single') {
    try {
        await safeAnswerCbQuery(ctx); // Убираем индикатор загрузки
        
        ctx.session = ctx.session || {};
        ctx.session.waitingFor = 'email';
        ctx.session.selectedPackage = packageKey;
        
        const pkg = PACKAGES[packageKey];
        
        await ctx.editMessageText(
            MESSAGES.EMAIL_REQUEST(pkg),
            {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '⏪ Вернуться назад', callback_data: `select_package_${packageKey}` }]
                    ]
                }
            }
        );
    } catch (err) {
        console.error('❌ Error in handlePayCard:', err);
        await safeAnswerCbQuery(ctx, 'Произошла ошибка');
    }
}

// Обработчик оплаты криптой
export async function handlePayCrypto(ctx, packageKey = 'single') {
    try {
        await safeAnswerCbQuery(ctx); // Убираем индикатор загрузки
        
        ctx.session = ctx.session || {};
        ctx.session.selectedPackage = packageKey;
        
        const pkg = PACKAGES[packageKey];
        
        await ctx.editMessageText(
            MESSAGES.PAYMENT_CRYPTO_SELECT(pkg),
            { 
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '💵 USDT', callback_data: `crypto_USDT_${packageKey}` }],
                        [{ text: '💰 USDC', callback_data: `crypto_USDC_${packageKey}` }],
                        [{ text: '💎 TON', callback_data: `crypto_TON_${packageKey}` }],
                        [{ text: '🔙 Назад', callback_data: `select_package_${packageKey}` }]
                    ]
                }
            }
        );
    } catch (err) {
        console.error('❌ Error in handlePayCrypto:', err);
        await safeAnswerCbQuery(ctx, 'Произошла ошибка');
    }
}

// Обработчик выбора криптовалюты
export async function handleCryptoSelect(ctx, crypto, packageKey = 'single') {
    try {
        await safeAnswerCbQuery(ctx); // Убираем индикатор загрузки
        
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('🎯 [PaymentController] handleCryptoSelect called');
        console.log(`📊 Params: crypto=${crypto}, packageKey=${packageKey}`);
        console.log(`👤 User: ${ctx.from.id} (@${ctx.from.username})`);
        
        const chains = SUPPORTED_CRYPTO[crypto];
        console.log(`🔗 Available chains for ${crypto}:`, chains?.length || 0);
        
        if (!chains || chains.length === 0) {
            console.error(`❌ No chains found for crypto: ${crypto}`);
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            return await safeAnswerCbQuery(ctx, 'Эта криптовалюта временно недоступна');
        }
        
        ctx.session = ctx.session || {};
        ctx.session.selectedPackage = packageKey;
        
        const pkg = PACKAGES[packageKey];
        if (!pkg) {
            console.error('❌ Package not found:', packageKey);
            return await safeAnswerCbQuery(ctx, 'Пакет не найден');
        }
        
        // Создаем кнопки для сетей
        const chainButtons = chains.map(chain => [{
            text: chain.name,
            callback_data: `chain_${crypto}_${chain.processing.replace(/\s+/g, '_')}_${packageKey}`
        }]);
        
        chainButtons.push(
            [{ text: '🔙 Назад', callback_data: `pay_crypto_${packageKey}` }]
        );
        
        await ctx.editMessageText(
            MESSAGES.PAYMENT_CRYPTO_NETWORK(pkg, crypto),
            { 
                reply_markup: {
                    inline_keyboard: chainButtons
                }
            }
        );
    } catch (err) {
        console.error('❌ Error in handleCryptoSelect:', err);
        await safeAnswerCbQuery(ctx, 'Произошла ошибка');
    }
}

// Обработчик выбора сети
export async function handleChainSelect(ctx, crypto, chain, packageKey = 'single') {
    try {
        await safeAnswerCbQuery(ctx); // Убираем индикатор загрузки
        
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('🎯 [PaymentController] handleChainSelect called');
        console.log(`📊 Params: crypto=${crypto}, chain=${chain}, packageKey=${packageKey}`);
        console.log(`👤 User: ${ctx.from.id} (@${ctx.from.username})`);
        
        const userId = ctx.from.id;
        const payCurrency = chain.replace(/_/g, ' ');
        const pkg = PACKAGES[packageKey];
        
        console.log('💰 Payment params prepared:');
        console.log(`  - userId: ${userId}`);
        console.log(`  - payCurrency BEFORE: "${chain}"`);
        console.log(`  - payCurrency AFTER: "${payCurrency}"`);
        console.log(`  - amount: ${pkg.usdt} USDT`);
        console.log(`  - package: ${packageKey}`);
        console.log(`  - generations: ${pkg.generations}`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        
        console.log('🚀 Calling paymentCryptoService.createPayment...');
        const payment = await paymentCryptoService.createPayment({
            userId,
            amount: pkg.usdt,
            payCurrency,
            package: packageKey
        });
        
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📥 Payment service response received');
        console.log(`Response type: ${typeof payment}`);
        console.log(`Has error: ${!!payment.error}`);
        
        if (payment.error) {
            console.error('❌ Payment creation failed with error:', payment.error);
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            return await safeAnswerCbQuery(ctx, payment.error, { show_alert: true });
        }
        
        console.log('✅ Payment created successfully!');
        console.log(`Order ID: ${payment.orderId}`);
        console.log('📦 Payment output:', JSON.stringify(payment.output, null, 2));
        
        // Извлекаем данные для оплаты
        const address = payment.output?.address || payment.output?.Address || payment.output?.wallet;
        const amount = payment.cryptoAmount || payment.input?.amount || pkg.usdt;
        const destinationTag = payment.output?.destinationTag || payment.output?.DestinationTag || payment.output?.memo;
        const qrCode = payment.output?.qrCode;
        
        console.log('✅ Extracted payment data:', { 
            orderId: payment.orderId, 
            address, 
            amount, 
            cryptoAmount: payment.cryptoAmount,
            destinationTag,
            currency: payment.currency,
            hasQR: !!qrCode
        });
        
        // Получаем ссылку на страницу оплаты
        const paymentUrl = payment.output?.paymentUrl || null;
        
        // Формируем сообщение
        let message = `${pkg.emoji} ${pkg.title}\n\n`;
        message += `💰 Сумма: <code>${amount}</code> ${payCurrency}\n`;
        message += `💵 Стоимость: $${pkg.usdt}\n\n`;
        
        // Если есть адрес, показываем его
        if (address) {
            message += `📍 Адрес для оплаты:\n<code>${address}</code>\n\n`;
            
            if (destinationTag) {
                message += `🏷️ Memo/Tag: <code>${destinationTag}</code>\n⚠️ ТЕГ ОБЯЗАТЕЛЕН!\n\n`;
            }
            
            message += `💡 Нажмите на адрес, чтобы скопировать\n\n`;
            message += `⏰ У вас есть 30 минут для оплаты\n`;
            message += `👇 Нажмите кнопку ниже для перехода к оплате`;
        } else {
            // Если адреса нет, показываем только ссылку
            message += `⏰ У вас есть 30 минут для оплаты\n\n`;
            message += `👇 Нажмите кнопку ниже для перехода к странице оплаты\n`;
            message += `На странице вы увидите адрес кошелька и QR-код`;
        }
        
        const keyboard = createPaymentCryptoKeyboard(payment.orderId, packageKey);
        
        // Если есть QR-код, отправляем его как фото
        if (qrCode && address) {
            try {
                console.log('📸 Sending QR code...');
                
                // Удаляем сообщение с выбором
                await ctx.deleteMessage().catch(() => {});
                
                // Отправляем QR-код
                await ctx.replyWithPhoto(
                    { source: Buffer.from(qrCode.replace(/^data:image\/\w+;base64,/, ''), 'base64') },
                    {
                        caption: message,
                        parse_mode: 'HTML',
                        reply_markup: keyboard
                    }
                );
                
                console.log('✅ QR code sent successfully');
                console.log('⏱️ Response time:', Date.now() - ctx.callbackQuery.message.date * 1000, 'ms');
                console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
                return; // Важно! Выходим чтобы не пытаться редактировать удаленное сообщение
            } catch (qrErr) {
                console.error('⚠️ Failed to send QR code:', qrErr.message);
                // Если не удалось отправить QR, пробуем отправить просто текст
                try {
                    await ctx.reply(message, {
                        parse_mode: 'HTML',
                        reply_markup: keyboard
                    });
                    return;
                } catch (replyErr) {
                    console.error('⚠️ Failed to send reply:', replyErr.message);
                }
            }
        }
        
        // Без QR-кода или если не удалось отправить - редактируем сообщение
        await ctx.editMessageText(message, {
            parse_mode: 'HTML',
            reply_markup: keyboard
        });
    } catch (err) {
        console.error('❌ Error in handleChainSelect:', err);
        console.error('Stack:', err.stack);
        await safeAnswerCbQuery(ctx, 'Произошла ошибка');
    }
}

// Проверка статуса платежа
export async function handleCheckPayment(ctx, orderId) {
    try {
        console.log(`🔍 Checking payment status for order: ${orderId}`);
        
        const order = await orderService.getOrderById(orderId);
        
        if (!order) {
            console.log(`❌ Order not found: ${orderId}`);
            return await safeAnswerCbQuery(ctx, 'Заказ не найден', { show_alert: true });
        }
        
        if (order.isPaid) {
            console.log(`✅ Order already paid: ${orderId}`);
            return await safeAnswerCbQuery(ctx, 'Этот заказ уже оплачен!', { show_alert: true });
        }
        
        // Показываем что проверяем
        await safeAnswerCbQuery(ctx, '⏳ Проверяем транзакцию...');
        
        // Проверяем статус через API 0xProcessing
        console.log(`📡 Checking payment status via API for order: ${orderId}`);
        const result = await paymentCryptoService.checkPaymentStatus(orderId);
        
        if (result.error) {
            console.log(`❌ Error checking payment: ${result.error}`);
            await ctx.reply('❌ Ошибка проверки платежа. Попробуйте позже.');
            return;
        }
        
        if (result.status === 'paid') {
            console.log(`✅ Payment confirmed for order: ${orderId}`);
            
            // Отмечаем заказ как оплаченный
            await orderService.markAsPaid(orderId);
            
            // Добавляем генерации
            const pkg = PACKAGES[order.package];
            await userService.addPaidQuota(order.userId, pkg.generations);
            
            // Обрабатываем кешбэк
            try {
                await referralService.processExpertCashback(order.userId, order.amount);
            } catch (cashbackErr) {
                console.error('⚠️ Cashback error:', cashbackErr.message);
            }
            
            // Уведомляем пользователя
            await ctx.reply(
                `✅ Оплата подтверждена!\n\n` +
                `${pkg.emoji} ${pkg.title}\n` +
                `💎 Добавлено генераций: ${pkg.generations}\n\n` +
                `Теперь вы можете создавать видео!`,
                {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '🎬 Создать видео', callback_data: 'catalog' }],
                            [{ text: '👤 Личный кабинет', callback_data: 'profile' }]
                        ]
                    }
                }
            );
        } else {
            console.log(`⏳ Payment still pending for order: ${orderId}`);
            await ctx.reply(
                '⏳ Платеж ещё не поступил\n\n' +
                'Пожалуйста, подождите несколько минут после отправки транзакции.\n\n' +
                '💡 Обычно подтверждение занимает 1-5 минут.'
            );
        }
        
    } catch (err) {
        console.error('❌ Error in handleCheckPayment:', err);
        await safeAnswerCbQuery(ctx, 'Произошла ошибка');
    }
}

// Обработчик успешного платежа (вызывается из webhook)
export async function handlePaymentSuccess(bot, orderId) {
    try {
        const order = await orderService.getOrderById(orderId);
        if (!order) return;
        
        // Отмечаем заказ как оплаченный
        await orderService.markAsPaid(orderId);
        
        // Добавляем генерации пользователю
        const pkg = PACKAGES[order.package];
        await userService.addPaidQuota(order.userId, pkg.generations);
        
        // Обрабатываем реферальный кешбэк для эксперта
        const cashbackResult = await referralService.processExpertCashback(order.userId, order.amount);
        
        // Если был начислен кешбек, уведомляем эксперта
        if (cashbackResult) {
            try {
                await bot.telegram.sendMessage(
                    cashbackResult.expertId,
                    `💰 Новый кешбек!\n\nВаш реферал совершил покупку.\n\n` +
                    `💵 Сумма покупки: ${cashbackResult.originalAmount}₽\n` +
                    `🎁 Ваш кешбек (${cashbackResult.percent}%): ${cashbackResult.amount.toFixed(2)}₽\n\n` +
                    `📊 Общий заработок: ${(await userService.getUser(cashbackResult.expertId))?.totalCashback?.toFixed(2) || 0}₽`
                );
            } catch (notifyErr) {
                console.log(`Failed to notify expert ${cashbackResult.expertId}:`, notifyErr.message);
            }
        }
        
        // Отправляем уведомление пользователю
        const keyboard = createAfterPaymentKeyboard();
        await bot.telegram.sendMessage(
            order.userId,
            MESSAGES.PAYMENT_SUCCESS,
            { reply_markup: keyboard }
        );
        
        console.log(`✅ Payment ${orderId} processed successfully`);
    } catch (err) {
        console.error('❌ Error in handlePaymentSuccess:', err);
    }
}

// Обработчик "О проекте"
export async function handleAbout(ctx) {
    try {
        await safeAnswerCbQuery(ctx); // Убираем индикатор загрузки
        await ctx.editMessageText(MESSAGES.ABOUT, { reply_markup: ABOUT_KEYBOARD });
    } catch (err) {
        console.error('❌ Error in handleAbout:', err);
        await safeAnswerCbQuery(ctx, 'Произошла ошибка');
    }
}

// Обработчик реферальной программы
export async function handleReferral(ctx) {
    try {
        await safeAnswerCbQuery(ctx); // Убираем индикатор загрузки
        
        if (!REFERRAL_ENABLED) {
            return await safeAnswerCbQuery(ctx, '⏳ Реферальная программа скоро будет доступна!', { show_alert: true });
        }
        
        const userId = ctx.from.id;
        const user = await userService.getUser(userId);
        const botName = process.env.BOT_NAME || 'meemee_bot';
        const stats = await referralService.getReferralStats(userId);
        
        // Проверяем, является ли пользователь экспертом
        const isExpert = user?.isExpert || false;
        
        if (isExpert) {
            // Для экспертов
            const refLink = `https://t.me/${botName}?start=expert_${userId}`;
            
            let message = MESSAGES.EXPERT_REFERRAL_INFO(stats);
            message += `\n<code>${refLink}</code>\n\n`;
            message += `📊 Статистика:\n`;
            message += `👥 Приглашено: ${stats.expertReferrals || 0}\n`;
            message += `💰 Заработано: ${(stats.totalCashback || 0).toFixed(2)}₽`;
            
            await ctx.editMessageText(
                message,
                {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '📥 Пригласить друга', url: `https://t.me/share/url?url=${encodeURIComponent(refLink)}` }],
                            [{ text: '⏪ Вернуться назад', callback_data: 'main_menu' }]
                        ]
                    },
                    parse_mode: 'HTML'
                }
            );
        } else {
            // Для обычных пользователей
            const refLink = `https://t.me/${botName}?start=ref_${userId}`;
            
            let message = MESSAGES.REFERRAL_INFO;
            message += `\n<code>${refLink}</code>`;
            
            await ctx.editMessageText(
                message,
                {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '📥 Пригласить друга', url: `https://t.me/share/url?url=${encodeURIComponent(refLink)}` }],
                            [{ text: '⏪ Вернуться назад', callback_data: 'main_menu' }]
                        ]
                    },
                    parse_mode: 'HTML'
                }
            );
        }
    } catch (err) {
        console.error('❌ Error in handleReferral:', err);
        await safeAnswerCbQuery(ctx, 'Произошла ошибка');
    }
}

// Обработчик реферальной программы для пользователей (заглушка)
export async function handleRefUser(ctx) {
    try {
        await safeAnswerCbQuery(ctx, '⏳ Скоро будет доступно!', { show_alert: true });
    } catch (err) {
        console.error('❌ Error in handleRefUser:', err);
    }
}

// Обработчик реферальной программы для экспертов (заглушка)
export async function handleRefExpert(ctx) {
    try {
        await safeAnswerCbQuery(ctx, '⏳ Скоро будет доступно!', { show_alert: true });
    } catch (err) {
        console.error('❌ Error in handleRefExpert:', err);
    }
}

// Обработчик Stars
export async function handlePayStarsSoon(ctx, packageKey = 'single') {
    try {
        await safeAnswerCbQuery(ctx);
        
        const pkg = PACKAGES[packageKey];
        
        await ctx.editMessageText(
            MESSAGES.PAYMENT_STARS_INFO,
            {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: `❤️ ${pkg.title} - ${pkg.stars}⭐️ - $${pkg.usdt}`, callback_data: `stars_pay_${packageKey}` }],
                        [{ text: '⏪ Вернуться назад', callback_data: `select_package_${packageKey}` }]
                    ]
                }
            }
        );
    } catch (err) {
        console.error('❌ Error in handlePayStarsSoon:', err);
        await safeAnswerCbQuery(ctx, 'Произошла ошибка');
    }
}

// Обработчик личного кабинета
export async function handleProfile(ctx) {
    try {
        await safeAnswerCbQuery(ctx); // Убираем индикатор загрузки
        
        const userId = ctx.from.id;
        const user = await userService.getUser(userId);
        const generations = await generationService.getUserGenerations(userId);
        const referralStats = await referralService.getReferralStats(userId);
        
        if (!user) {
            return await safeAnswerCbQuery(ctx, 'Ошибка загрузки профиля', { show_alert: true });
        }
        
        const message = MESSAGES.PROFILE(user, generations, referralStats);
        
        await ctx.editMessageText(message, {
            reply_markup: {
                inline_keyboard: [
                    [{ text: '📃 История генераций', callback_data: 'profile_history' }],
                    [{ text: '💳 Купить видео', callback_data: 'buy' }],
                    [{ text: '🔙 Главное меню', callback_data: 'main_menu' }]
                ]
            }
        });
    } catch (err) {
        console.error('❌ Error in handleProfile:', err);
        await safeAnswerCbQuery(ctx, 'Произошла ошибка');
    }
}

// Обработчик истории генераций
export async function handleProfileHistory(ctx) {
    try {
        await safeAnswerCbQuery(ctx); // Убираем индикатор загрузки
        
        const userId = ctx.from.id;
        const allGenerations = await generationService.getUserGenerations(userId);
        
        if (!allGenerations || allGenerations.length === 0) {
            return await ctx.editMessageText(
                '📜 История генераций пуста\n\nВы ещё не создали ни одного видео.',
                {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '🎬 Создать видео', callback_data: 'catalog' }],
                            [{ text: '🔙 Назад', callback_data: 'profile' }]
                        ]
                    }
                }
            );
        }
        
        // Получаем номер страницы из callback_data (по умолчанию 0)
        const page = parseInt(ctx.match?.[1]) || 0;
        const perPage = 10;
        const totalPages = Math.ceil(allGenerations.length / perPage);
        
        // Берём только генерации для текущей страницы (последние сначала)
        const startIdx = page * perPage;
        const endIdx = startIdx + perPage;
        const generations = allGenerations.slice(startIdx, endIdx);
        
        let message = `📜 История генераций (${allGenerations.length} всего)\n`;
        message += `📄 Страница ${page + 1} из ${totalPages}\n\n`;
        
        generations.forEach((gen, idx) => {
            const statusEmoji = gen.status === 'done' ? '✅' : gen.status === 'failed' ? '❌' : gen.status === 'processing' ? '⏳' : '🕐';
            const date = new Date(gen.createdAt).toLocaleString('ru-RU');
            const globalIdx = startIdx + idx + 1;
            message += `${globalIdx}. ${statusEmoji} ${gen.memeName}\n`;
            message += `   👤 Имя: ${gen.name} (${gen.gender === 'male' ? 'М' : 'Ж'})\n`;
            message += `   📅 ${date}\n`;
            
            if (gen.status === 'failed' && gen.error) {
                message += `   ⚠️ Ошибка: ${gen.error}\n`;
            }
            message += '\n';
        });
        
        // Создаём кнопки для пагинации
        const keyboard = {
            inline_keyboard: []
        };
        
        // Кнопки навигации по страницам
        if (totalPages > 1) {
            const navButtons = [];
            if (page > 0) {
                navButtons.push({ text: '⬅️ Назад', callback_data: `profile_history:${page - 1}` });
            }
            if (page < totalPages - 1) {
                navButtons.push({ text: 'Вперёд ➡️', callback_data: `profile_history:${page + 1}` });
            }
            if (navButtons.length > 0) {
                keyboard.inline_keyboard.push(navButtons);
            }
        }
        
        keyboard.inline_keyboard.push([{ text: '🔙 Назад в профиль', callback_data: 'profile' }]);
        keyboard.inline_keyboard.push([{ text: '🏠 Главное меню', callback_data: 'main_menu' }]);
        
        await ctx.editMessageText(message, { reply_markup: keyboard });
    } catch (err) {
        console.error('❌ Error in handleProfileHistory:', err);
        await safeAnswerCbQuery(ctx, 'Произошла ошибка');
    }
}
