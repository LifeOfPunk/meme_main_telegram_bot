import { MESSAGES, PACKAGES, SUPPORTED_CRYPTO, REFERRAL_ENABLED, REFERRAL_TYPE_KEYBOARD, ABOUT_KEYBOARD } from '../config.js';
import { createCryptoKeyboard, createChainKeyboard, createPaymentCryptoKeyboard, createAfterPaymentKeyboard, createMainMenuKeyboard, createProfileKeyboard } from '../screens/keyboards.js';
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
        
        const buyText = `🎬 Чтобы сгенерировать видео, вам нужно их сначала купить, и после этого вы сможете уже генерировать новые видео.\n\n💎 Выберите подходящий пакет:`;
        
        const keyboard = {
            inline_keyboard: [
                ...packageButtons,
                [{ text: '💎 Крипта (Пополнить баланс)', callback_data: 'pay_crypto_deposit' }],
                [{ text: '🔙 Назад', callback_data: 'main_menu' }]
            ]
        };
        
        try {
            await ctx.editMessageText(buyText, {
                reply_markup: keyboard
            });
        } catch (editErr) {
            await ctx.reply(buyText, {
                reply_markup: keyboard
            });
        }
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
        
        const cardEnabled = process.env.CARD_ENABLED !== 'false';
        const cryptoEnabled = process.env.CRYPTO_ENABLED !== 'false';
        const starsEnabled = process.env.STARS_ENABLED === 'true';
        
        if (cardEnabled) {
            paymentButtons.push([{ text: '💳 Карта', callback_data: `pay_card_${packageKey}` }]);
        }
        
        if (cryptoEnabled) {
            paymentButtons.push([{ text: '💎 Крипта', callback_data: `pay_crypto_${packageKey}` }]);
        }
        
        if (starsEnabled) {
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

// Обработчик оплаты картой (Lava 1-Click без ввода email)
export async function handlePayCard(ctx, packageKey = 'pack_10') {
    try {
        await safeAnswerCbQuery(ctx); // Убираем индикатор загрузки
        
        const pkg = PACKAGES[packageKey] || PACKAGES['pack_10'];
        if (!pkg) {
            return await safeAnswerCbQuery(ctx, 'Пакет не найден', { show_alert: true });
        }
        
        const userId = ctx.from.id;
        const email = ctx.session?.email || `user${userId}@viralapp.bot`;
        
        ctx.session = ctx.session || {};
        delete ctx.session.waitingFor;
        ctx.session.selectedPackage = packageKey;
        ctx.session.email = email;
        
        // Показываем пользователю процесс генерации инвойса
        try {
            await ctx.editMessageText('⏳ Создаем ссылку на оплату картой...', {
                reply_markup: { inline_keyboard: [] }
            });
        } catch (e) {
            // ignore
        }
        
        const payment = await paymentFiatService.createPayment({
            userId,
            email,
            amount: pkg.rub,
            bank: 'BANK131',
            package: packageKey
        });
        
        if (payment.error) {
            const errText = '❌ Ошибка создания платежа: ' + payment.error;
            const errKeyboard = {
                inline_keyboard: [
                    [{ text: '🔙 Назад к пакетам', callback_data: `select_package_${packageKey}` }]
                ]
            };
            try {
                return await ctx.editMessageText(errText, { reply_markup: errKeyboard });
            } catch (e) {
                return await ctx.reply(errText, { reply_markup: errKeyboard });
            }
        }
        
        const paymentUrl = payment.output?.paymentUrl || payment.output?.payUrl || payment.output?.url || (payment.output?.id ? `https://lava.top/invoice/${payment.output.id}` : null);
        
        const message = MESSAGES.PAYMENT_CARD_CONFIRM(pkg);
        const keyboard = {
            inline_keyboard: [
                [{ text: '💳 Оплатить картой', url: paymentUrl }],
                [{ text: '❓ Обратная связь', url: 'https://t.me/aiviral_main' }],
                [{ text: '🔙 Назад к пакетам', callback_data: `select_package_${packageKey}` }]
            ]
        };
        
        try {
            await ctx.editMessageText(message, {
                parse_mode: 'HTML',
                reply_markup: keyboard
            });
        } catch (editErr) {
            await ctx.reply(message, {
                parse_mode: 'HTML',
                reply_markup: keyboard
            });
        }
    } catch (err) {
        console.error('❌ Error in handlePayCard:', err);
        await safeAnswerCbQuery(ctx, 'Произошла ошибка');
    }
}

// Обработчик оплаты картой в 1 клик (без ручного ввода email)
export async function handlePayCardOneClick(ctx, packageKey = 'pack_10') {
    return await handlePayCard(ctx, packageKey);
}

// Обработчик оплаты криптой (выбор криптовалюты в 1 шаг)
export async function handlePayCrypto(ctx, packageKey = 'deposit') {
    try {
        await safeAnswerCbQuery(ctx); // Убираем индикатор загрузки
        
        ctx.session = ctx.session || {};
        ctx.session.selectedPackage = packageKey;
        
        const pkg = PACKAGES[packageKey];
        const titleText = pkg ? `🎬 <b>${pkg.title}</b> (${pkg.usdt} USDT)\n` : `💎 <b>Пополнение баланса криптовалютой</b>\n`;
        const message = `${titleText}\n` +
            `💰 <b>Свободный депозит:</b> от 0.50 USDT до 10 000.00 USDT\n\n` +
            `Выберите сеть для оплаты в 1 шаг:`;
        
        const backTarget = packageKey && packageKey !== 'deposit' ? `select_package_${packageKey}` : 'buy';
        
        // 4 кнопки сетей сразу в 1 шаг согласно спецификации TASK-02-03
        const cryptoButtons = [
            [{ text: '💎 TON (Gram)', callback_data: `chain_TON_TON_${packageKey}` }],
            [{ text: '⚡ USDT (BEP20)', callback_data: `chain_USDT_USDT_(BEP20)_${packageKey}` }],
            [{ text: '🟣 USDT (SOL)', callback_data: `chain_USDT_USDT_(SOL)_${packageKey}` }],
            [{ text: '🟡 BNB (BEP20)', callback_data: `chain_BNB_BNB_(BEP20)_${packageKey}` }],
            [{ text: '🔙 Назад', callback_data: backTarget }]
        ];
        
        try {
            await ctx.editMessageText(message, { 
                parse_mode: 'HTML',
                reply_markup: {
                    inline_keyboard: cryptoButtons
                }
            });
        } catch (editErr) {
            await ctx.reply(message, {
                parse_mode: 'HTML',
                reply_markup: {
                    inline_keyboard: cryptoButtons
                }
            });
        }
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

// Обработчик выбора сети (0xProcessing)
export async function handleChainSelect(ctx, crypto, chain, packageKey = 'deposit') {
    try {
        await safeAnswerCbQuery(ctx); // Убираем индикатор загрузки
        
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('🎯 [PaymentController] handleChainSelect called');
        console.log(`📊 Params: crypto=${crypto}, chain=${chain}, packageKey=${packageKey}`);
        console.log(`👤 User: ${ctx.from.id} (@${ctx.from.username})`);
        
        const userId = ctx.from.id;
        const payCurrency = chain.replace(/_/g, ' ');
        const pkg = PACKAGES[packageKey];
        const targetAmount = pkg ? pkg.usdt : 0.50;
        
        console.log('💰 Payment params prepared:');
        console.log(`  - userId: ${userId}`);
        console.log(`  - payCurrency: "${payCurrency}"`);
        console.log(`  - amount: ${targetAmount} USDT`);
        console.log(`  - package: ${packageKey}`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        
        console.log('🚀 Calling paymentCryptoService.createPayment...');
        const payment = await paymentCryptoService.createPayment({
            userId,
            amount: targetAmount,
            payCurrency,
            package: packageKey
        });
        
        if (payment.error) {
            console.error('❌ Payment creation failed with error:', payment.error);
            return await safeAnswerCbQuery(ctx, payment.error, { show_alert: true });
        }
        
        const address = payment.output?.address || payment.output?.Address || payment.output?.wallet;
        const destinationTag = payment.output?.destinationTag || payment.output?.DestinationTag || payment.output?.memo;
        const qrCode = payment.output?.qrCode;
        const paymentUrl = payment.output?.paymentUrl || null;
        
        if (!address) {
            return await safeAnswerCbQuery(ctx, 'Не удалось получить адрес кошелька. Попробуйте другую сеть.', { show_alert: true });
        }
        
        // Формируем экран пополнения: отображать лимиты Min: 0.50 USDT, Max: 10000 USDT, моноширинный адрес <code>, предупреждение о комиссиях бирж
        let message = `💎 <b>Пополнение баланса криптовалютой (0xProcessing)</b>\n\n`;
        message += `🌐 <b>Сеть:</b> <code>${payCurrency}</code>\n`;
        message += `💵 <b>Лимиты:</b>\n`;
        message += `├─ <b>Min:</b> 0.50 USDT\n`;
        message += `└─ <b>Max:</b> 10000.00 USDT\n\n`;
        message += `📍 <b>Адрес:</b>\n<code>${address}</code>\n\n`;
        
        if (destinationTag) {
            message += `🏷️ <b>Memo/Tag:</b> <code>${destinationTag}</code>\n⚠️ <b>ТЕГ ОБЯЗАТЕЛЕН!</b> Без него средства не зачислятся.\n\n`;
        }
        
        message += `⚠️ <b>ВНИМАНИЕ: Если отправляете с БИРЖИ (Gate, Bybit, Binance, OKX):</b>\n`;
        message += `Биржа удерживает фиксированную комиссию из суммы вывода!\n`;
        message += `Убедитесь, что чистая сумма поступления <b>не менее 0.50 USDT</b>.\n`;
        message += `<i>Вся фактически поступившая сумма зачисляется 1 к 1 на ваш баланс.</i>\n\n`;
        message += `💡 <i>Нажмите на адрес выше, чтобы скопировать</i>\n`;
        message += `⏰ Реквизиты активны 30 минут.\n`;
        message += `👇 После отправки нажмите кнопку «Проверить оплату»`;
        
        const keyboard = createPaymentCryptoKeyboard(payment.orderId, packageKey, address, paymentUrl);
        
        // Отправляем нативный QR-код изображением в чат (replyWithPhoto)
        if (qrCode) {
            try {
                console.log('📸 Sending native QR code photo...');
                await ctx.deleteMessage().catch(() => {});
                
                await ctx.replyWithPhoto(
                    { source: Buffer.from(qrCode.replace(/^data:image\/\w+;base64,/, ''), 'base64') },
                    {
                        caption: message,
                        parse_mode: 'HTML',
                        reply_markup: keyboard
                    }
                );
                console.log('✅ QR code photo sent successfully');
                return;
            } catch (qrErr) {
                console.error('⚠️ Failed to send QR code photo:', qrErr.message);
                try {
                    await ctx.reply(message, {
                        parse_mode: 'HTML',
                        reply_markup: keyboard
                    });
                    return;
                } catch (replyErr) {
                    console.error('⚠️ Failed to send fallback text:', replyErr.message);
                }
            }
        }
        
        await ctx.editMessageText(message, {
            parse_mode: 'HTML',
            reply_markup: keyboard
        });
    } catch (err) {
        console.error('❌ Error in handleChainSelect:', err);
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
            
            // Если выбран фиксированный пакет - начисляем генерации
            const pkg = PACKAGES[order.package];
            if (pkg) {
                await userService.addPaidQuota(order.userId, pkg.generations);
            }
            
            // Зачисляем фактически поступившую сумму 1 к 1 на баланс USDT (TASK-02-03)
            const depositAmount = Number(order.amount || 0.50);
            await userService.addWalletBalance(order.userId, depositAmount);
            
            // Обрабатываем кешбэк
            try {
                await referralService.processExpertCashback(order.userId, order.amount);
            } catch (cashbackErr) {
                console.error('⚠️ Cashback error:', cashbackErr.message);
            }
            
            // Уведомляем пользователя
            const successText = pkg
                ? `✅ <b>Оплата подтверждена!</b>\n\n${pkg.emoji} ${pkg.title}\n💎 Добавлено генераций: ${pkg.generations}\n\nТеперь вы можете создавать видео!`
                : `✅ <b>Депозит успешно зачислен!</b>\n\n💰 На ваш баланс зачислено: <b>${depositAmount.toFixed(2)} USDT</b>\n\nТеперь вы можете создавать видео!`;
            
            await ctx.reply(
                successText,
                {
                    parse_mode: 'HTML',
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
        
        // Добавляем генерации пользователю если фиксированный пакет
        const pkg = PACKAGES[order.package];
        if (pkg) {
            await userService.addPaidQuota(order.userId, pkg.generations);
        }
        
        // Зачисляем сумму 1 к 1 на баланс USDT (TASK-02-03)
        const depositAmount = Number(order.amount || 0.50);
        await userService.addWalletBalance(order.userId, depositAmount);
        
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
        const botName = process.env.BOT_NAME || 'viralapp_official_bot';
        const stats = await referralService.getReferralStats(userId);
        
        const refLink = `https://t.me/${botName}?start=expert_${userId}`;
        
        let message = `💼 <b>Реферальная программа</b>\n\n`;
        message += `Получай <b>25%</b> с 1-й линии и <b>10%</b> со 2-й линии с каждой оплаты приглашённых пользователей!\n\n`;
        message += `🔗 Твоя персональная ссылка:\n<code>${refLink}</code>\n\n`;
        message += `📊 <b>Статистика:</b>\n`;
        message += `👥 Приглашено: ${stats?.expertReferrals || stats?.referredUsers || 0}\n`;
        const rawCashback = user?.totalCashback ?? stats?.totalCashback ?? user?.affiliate_earnings ?? 0;
        message += `💰 Заработано: ${Number(rawCashback || 0).toFixed(2)} USDT`;
        
        const keyboard = {
            inline_keyboard: [
                [{ text: '📥 Пригласить друга', url: `https://t.me/share/url?url=${encodeURIComponent(refLink)}` }],
                [{ text: '🔙 Назад в профиль', callback_data: 'profile' }]
            ]
        };

        try {
            await ctx.editMessageText(message, {
                reply_markup: keyboard,
                parse_mode: 'HTML'
            });
        } catch (editErr) {
            await ctx.reply(message, {
                reply_markup: keyboard,
                parse_mode: 'HTML'
            });
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
        
        const userId = ctx.from?.id;
        if (!userId) return;
        const user = await userService.getUser(userId);
        const generations = await generationService.getUserGenerations(userId);
        const referralStats = await referralService.getReferralStats(userId);
        
        if (!user) {
            return await safeAnswerCbQuery(ctx, 'Ошибка загрузки профиля', { show_alert: true });
        }
        
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

export { handleWithdraw } from '../handlers/user_handlers/user_menu.js';
