import { MESSAGES, PACKAGES, SUPPORTED_CRYPTO, REFERRAL_ENABLED, REFERRAL_TYPE_KEYBOARD, ABOUT_KEYBOARD, GENERATION_COST_USDT } from '../config.js';
import { createCryptoKeyboard, createChainKeyboard, createPaymentCryptoKeyboard, createAfterPaymentKeyboard, createMainMenuKeyboard, createProfileKeyboard } from '../screens/keyboards.js';
import { PaymentCryptoService } from '../services/PaymentCrypto.service.js';
import { PaymentFiatService } from '../services/PaymentFiat.service.js';
import { UserService } from '../services/User.service.js';
import { OrderService } from '../services/Order.service.js';
import { ReferralService } from '../services/Referral.service.js';
import { GenerationService } from '../services/Generation.service.js';
import { currencyService } from '../services/Currency.service.js';

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
        
        // Карта скрыта: ведём сразу на экран выбора крипто-сети (депозит, «в 1 шаг»)
        return await handlePayCrypto(ctx, 'deposit');
    } catch (err) {
        console.error('❌ Error in handleBuy:', err);
        await safeAnswerCbQuery(ctx, 'Произошла ошибка');
    }
}

// Обработчик экрана пакетов для банковской карты (TASK-02-03, TASK-15)
export async function handlePayCardPackages(ctx) {
    try {
        await safeAnswerCbQuery(ctx);
        
        const packageButtons = [
            [{ text: '🎬 500₽', callback_data: 'pay_card_pack_10' }],
            [{ text: '📦 2250₽', callback_data: 'pay_card_pack_50' }],
            [{ text: '🎁 4250₽', callback_data: 'pay_card_pack_100' }],
            [{ text: '💎 20 000₽', callback_data: 'pay_card_pack_500' }],
            [{ text: '🔙 Назад к способам оплаты', callback_data: 'buy' }]
        ];

        const message = 'Выберите пакет для оплаты картой:';
        
        try {
            await ctx.editMessageText(message, {
                reply_markup: { inline_keyboard: packageButtons }
            });
        } catch {
            await ctx.reply(message, {
                reply_markup: { inline_keyboard: packageButtons }
            });
        }
    } catch (err) {
        console.error('❌ Error in handlePayCardPackages:', err);
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
        
        // Динамический пересчет рублей в доллары по ЦБ РФ и расчет количества генераций (1.30$ за видео)
        let dynamicUsd = pkg.usdt;
        let dynamicGenerations = pkg.generations;
        try {
            const conversion = await currencyService.rubToUsdFloor(pkg.rub);
            dynamicUsd = conversion.usd;
            dynamicGenerations = Math.floor(conversion.usd / GENERATION_COST_USDT);
        } catch (currErr) {
            console.warn('⚠️ Currency conversion fallback:', currErr.message);
        }

        const message = MESSAGES.PAYMENT_CARD_CONFIRM(pkg, dynamicUsd, dynamicGenerations);
        const keyboard = {
            inline_keyboard: [
                [{ text: '💳 Оплатить картой', url: paymentUrl }],
                [{ text: '❓ Обратная связь', url: 'https://t.me/aiviral_main' }],
                [{ text: '🔙 Назад к пакетам', callback_data: 'pay_card_packages' }]
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
        const userId = ctx.from?.id;
        const walletBalance = userId ? await userService.getUserWalletBalance(userId) : 0;
        const balanceFormatted = Number(walletBalance || 0).toFixed(2);
        
        const titleText = pkg ? `🎬 <b>${pkg.title}</b> (${pkg.usdt} USDT)\n` : `💎 <b>Пополнение баланса криптовалютой</b>\n`;
        const message = `${titleText}\n` +
            `💰 <b>Свободный депозит:</b> от 2.00 USDT до 10 000.00 USDT\n` +
            `🎬 <b>Стоимость генерации:</b> ${GENERATION_COST_USDT.toFixed(2)}$\n` +
            `💵 <b>Баланс кошелька:</b> ${balanceFormatted} USDT\n\n` +
            `Выберите сеть для оплаты в 1 шаг:\n\n` +
            `🔒 Проводя оплату, вы соглашаетесь с <a href="https://aiviral.agency/dogovor-oferta/">Договором-офертой</a> и <a href="https://aiviral.agency/politika-konfidencialnosti/">Политикой конфиденциальности</a>.`;
        
        const backTarget = packageKey && packageKey !== 'deposit' ? `select_package_${packageKey}` : 'main_menu';
        
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
        let targetAmount = pkg ? pkg.usdt : 2.00;
        if (!pkg && payCurrency.includes('BNB')) {
            targetAmount = 4.00;
        }
        
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
        
        let effectiveRate = payment.output?.rate ? parseFloat(payment.output.rate) : null;
        const isBnb = payCurrency.includes('BNB');
        const isGram = payCurrency.includes('TON') || payCurrency.includes('Gram');

        if (!effectiveRate || effectiveRate <= 0) {
            if (isGram) {
                effectiveRate = await currencyService.getCryptoRate('GRAMUSDT');
            } else if (isBnb) {
                effectiveRate = await currencyService.getCryptoRate('BNBUSDT');
            }
        }

        let minNote = '2.00 USDT';
        let dynamicMinGram = '1.25';
        let dynamicMinBnb = '0.0055';

        if (isBnb) {
            dynamicMinBnb = effectiveRate && effectiveRate > 0 ? (4.00 / effectiveRate).toFixed(4) : '0.0055';
            minNote = `4.00 USDT (~${dynamicMinBnb} BNB)`;
        } else if (isGram) {
            dynamicMinGram = effectiveRate && effectiveRate > 0 ? (2.00 / effectiveRate).toFixed(2) : '1.25';
            minNote = `2.00 USDT (~${dynamicMinGram} Gram)`;
        }

        // Формируем экран пополнения: адрес в <code>, динамические безопасные лимиты
        const NBSP = ' ';
        const networkLabel = isGram
            ? 'TON (The Open Network)'
            : payCurrency.replace(/^(\S+)\s+(.+)$/, '$1 ($2)');
        const minUsdt = isBnb ? '4' : '2';
        const amountLine = pkg
            ? `${pkg.usdt}${NBSP}USDT`
            : `от ${minUsdt} до 10${NBSP}000${NBSP}USDT`;

        let message = `💎 <b>Оплата криптовалютой</b>\n\n`;
        message += `🌐 <b>Сеть:</b> ${networkLabel}\n`;
        message += `💰 <b>Сумма:</b> ${amountLine}\n\n`;
        message += `📍 <b>Адрес</b> (нажмите, чтобы скопировать):\n<code>${address}</code>\n\n`;

        if (destinationTag) {
            message += `🏷️ <b>Memo/Tag</b> (нажмите, чтобы скопировать):\n<code>${destinationTag}</code>\n`;
            message += `⚠️ Тег обязателен — без него средства не зачислятся.\n\n`;
        }

        message += `⚠️ Минимум ${minUsdt}${NBSP}USDT — меньшие суммы блокчейн не зачислит.\n`;
        if (isGram) {
            message += `⚠️ Отправляйте только нативный <b>Gram${NBSP}(TON)</b>. USDT Jetton на этот адрес не зачисляется.\n`;
        }
        message += `❗ Отправьте оплату на этот адрес только <b>ОДИН раз</b>. Несколько переводов на один адрес засчитаются как один — не отправляйте повторно.\n`;
        message += `⏰ Реквизиты активны 30 минут.\n\n`;
        message += `После перевода нажмите «✅ Проверить оплату».`;

        const keyboard = createPaymentCryptoKeyboard(payment.orderId, packageKey, address, paymentUrl);
        
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
        console.error('❌ Error in handleChainSelect:', err);
        await safeAnswerCbQuery(ctx, 'Произошла ошибка');
    }
}

// Показ QR-кода по отдельной кнопке пользователя (TASK-20)
export async function handleShowQrCode(ctx, orderId) {
    try {
        await safeAnswerCbQuery(ctx, 'Генерируем QR-код...');
        const order = await orderService.getOrderById(orderId);
        if (!order) {
            return await ctx.reply('❌ Заказ не найден');
        }

        const address = order.output?.address || order.output?.Address || order.output?.wallet;
        const qrCode = order.output?.qrCode;
        const payCurrency = order.currency || order.input?.currency || 'USDT';
        let effectiveRate = order.output?.rate ? parseFloat(order.output.rate) : null;
        const isBnb = payCurrency.includes('BNB');
        const isGram = payCurrency.includes('TON') || payCurrency.includes('Gram');

        if (!effectiveRate || effectiveRate <= 0) {
            if (isGram) {
                effectiveRate = await currencyService.getCryptoRate('GRAMUSDT');
            } else if (isBnb) {
                effectiveRate = await currencyService.getCryptoRate('BNBUSDT');
            }
        }

        let minNote = '2.00 USDT';
        if (isBnb) {
            const bnbMin = effectiveRate && effectiveRate > 0 ? (4.00 / effectiveRate).toFixed(4) : '0.0055';
            minNote = `4.00 USDT (~${bnbMin} BNB)`;
        } else if (isGram) {
            const gramMin = effectiveRate && effectiveRate > 0 ? (2.00 / effectiveRate).toFixed(2) : '1.25';
            minNote = `2.00 USDT (~${gramMin} Gram)`;
        }

        const keyboard = {
            inline_keyboard: [
                [{ text: '✅ Проверить оплату', callback_data: `check_payment_${orderId}` }],
                [{ text: '🔙 Назад к способам оплаты', callback_data: 'buy' }]
            ]
        };

        const caption = `📱 <b>QR-код для оплаты (${payCurrency})</b>\n\n` +
            `📍 <b>Адрес:</b>\n<code>${address}</code>\n\n` +
            (order.output?.destinationTag ? `🏷️ <b>Memo/Tag:</b> <code>${order.output.destinationTag}</code>\n⚠️ <b>ТЕГ ОБЯЗАТЕЛЕН!</b>\n\n` : '') +
            `⚠️ <b>Минимальная сумма:</b> ${minNote}\n\n` +
            `👇 После отправки транзакции нажмите кнопку «Проверить оплату»`;

        if (qrCode) {
            await ctx.replyWithPhoto(
                { source: Buffer.from(qrCode.replace(/^data:image\/\w+;base64,/, ''), 'base64') },
                {
                    caption,
                    parse_mode: 'HTML',
                    reply_markup: keyboard
                }
            );
        } else {
            await ctx.reply(caption, {
                parse_mode: 'HTML',
                reply_markup: keyboard
            });
        }
    } catch (err) {
        console.error('❌ Error in handleShowQrCode:', err);
        await safeAnswerCbQuery(ctx, 'Не удалось отобразить QR-код');
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

        // Проверяем срок действия заявки (30 минут)
        const rawDate = order.createdAt || order.input?.createdAt;
        const orderTime = rawDate ? new Date(rawDate).getTime() : 0;
        const expTime = order.output?.expDate ? new Date(order.output.expDate).getTime() : 0;
        const isExpired = (
            (expTime > 0 && Date.now() > expTime) ||
            (orderTime > 0 && Date.now() - orderTime > 30 * 60 * 1000)
        );
        if (isExpired) {
            console.log(`⌛ Order expired: ${orderId}`);
            return await ctx.reply(
                '⏳ <b>Срок действия заявки истёк</b>\n\n' +
                'Время на оплату (30 минут) завершилось. Если средства не отправлялись, создайте новую заявку.\n\n' +
                '💡 Если транзакция уже отправлена в блокчейн, дождитесь подтверждения сетью.',
                {
                    parse_mode: 'HTML',
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '💳 Пополнить баланс', callback_data: 'buy' }],
                            [{ text: '👤 Личный кабинет', callback_data: 'profile' }]
                        ]
                    }
                }
            );
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

            // P0-03: атомарный идемпотентный claim
            const claimed = await orderService.tryClaimForPayment(orderId);
            if (!claimed) {
                console.log(`⚠️ Order ${orderId} already claimed.`);
                return await ctx.reply('✅ Этот платеж уже успешно зачислен на ваш баланс!');
            }

            // P0-04: начисляем сумму ЗАКАЗА, а не весь баланс адреса
            const depositAmount = Number(order.amount || 0);

            // Отмечаем заказ как оплаченный
            await orderService.markAsPaid(orderId, {
                paidAmount: depositAmount,
                status: 'paid'
            });
            
            // P1-07: пакет -> только генерации; депозит -> только баланс
            const pkg = PACKAGES[order.package];
            if (pkg) {
                await userService.addPaidQuota(order.userId, pkg.generations);
            } else {
                await userService.addWalletBalance(order.userId, depositAmount);
            }
            
            // Обрабатываем кешбэк
            try {
                await referralService.processExpertCashback(order.userId, pkg ? Number(pkg.usdt || 0) : depositAmount); // P1-08
            } catch (cashbackErr) {
                console.error('⚠️ Cashback error:', cashbackErr.message);
            }
            
            // Уведомляем пользователя
            const successText = pkg
                ? `✅ <b>Оплата подтверждена!</b>\n\n${pkg.emoji} ${pkg.title}\n💎 Добавлено генераций: ${pkg.generations}\n\nТеперь вы можете создавать видео!`
                : `✅ <b>Депозит успешно зачислен!</b>\n\n💰 Зачислено на баланс: <b>${depositAmount.toFixed(2)} USDT</b>\n\nТеперь вы можете создавать видео!`;
            
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

        // P0-03: атомарный идемпотентный claim
        const claimed = await orderService.tryClaimForPayment(orderId);
        if (!claimed) return;
        await orderService.markAsPaid(orderId);

        // P1-07: пакет -> только генерации; депозит -> только баланс
        const pkg = PACKAGES[order.package];
        const depositAmount = Number(order.amount || 0);
        if (pkg) {
            await userService.addPaidQuota(order.userId, pkg.generations);
        } else {
            await userService.addWalletBalance(order.userId, depositAmount);
        }

        // Обрабатываем реферальный кешбэк для эксперта
        const cashbackResult = await referralService.processExpertCashback(order.userId, pkg ? Number(pkg.usdt || 0) : depositAmount);
        
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
        
        const inviteText = `🔥 Делаю вирусные нейро-мемы и ролики за 60 секунд через ИИ!\n\nЗалетай по моей ссылке, забирай бесплатную попытку и создай свой первый вирусный ролик:`;
        // fix: share требует url= (иначе Telegram открывает telegram.org)
        const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(refLink)}&text=${encodeURIComponent(inviteText)}`;
        
        const keyboard = {
            inline_keyboard: [
                [{ text: '📥 Пригласить друга', url: shareUrl }],
                [{ text: '🔙 В личный кабинет', callback_data: 'profile' }],
                [{ text: '🏠 Главное меню', callback_data: 'main_menu' }]
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

// Обработчик истории транзакций пользователя (TASK-20)
export async function handleProfileTransactions(ctx) {
    try {
        await safeAnswerCbQuery(ctx);
        const userId = ctx.from.id;
        const allOrders = await orderService.getUserOrders(userId);

        if (!allOrders || allOrders.length === 0) {
            const emptyText = '💳 <b>История транзакций</b>\n\n' +
                'У вас пока нет транзакций или платежей.\n\n' +
                '💡 Чтобы пополнить баланс, выберите пакет в меню «Пополнить баланс».';

            const emptyKeyboard = {
                inline_keyboard: [
                    [{ text: '💳 Пополнить баланс', callback_data: 'buy' }],
                    [{ text: '🔙 Назад в профиль', callback_data: 'profile' }],
                    [{ text: '🏠 Главное меню', callback_data: 'main_menu' }]
                ]
            };

            return await ctx.editMessageText(emptyText, {
                parse_mode: 'HTML',
                reply_markup: emptyKeyboard
            });
        }

        // Сортировка от новых к старым (с поддержкой ord.createdAt и ord.input?.createdAt)
        allOrders.sort((a, b) => {
            const dateA = new Date(a.createdAt || a.input?.createdAt || a.paidAt || 0);
            const dateB = new Date(b.createdAt || b.input?.createdAt || b.paidAt || 0);
            return dateB - dateA;
        });

        const page = parseInt(ctx.match?.[1]) || 0;
        const perPage = 5;
        const totalPages = Math.max(1, Math.ceil(allOrders.length / perPage));

        const startIdx = page * perPage;
        const endIdx = startIdx + perPage;
        const orders = allOrders.slice(startIdx, endIdx);

        let message = `💳 <b>История транзакций</b> (${allOrders.length} всего)\n`;
        message += `📄 Страница ${page + 1} из ${totalPages}\n\n`;

        orders.forEach((ord, idx) => {
            const isPaid = Boolean(ord.isPaid);
            const isCanceled = ord.status === 'canceled' || ord.status === 'cancelled' || ord.output?.status === 'canceled' || ord.output?.status === 'cancelled';
            const rawDate = ord.createdAt || ord.input?.createdAt || ord.paidAt;
            const orderTime = rawDate ? new Date(rawDate).getTime() : 0;
            const expTime = ord.output?.expDate ? new Date(ord.output.expDate).getTime() : 0;
            const isExpired = !isPaid && !isCanceled && (
                (expTime > 0 && Date.now() > expTime) ||
                (orderTime > 0 && Date.now() - orderTime > 30 * 60 * 1000)
            );

            const statusEmoji = isPaid ? '✅' : (isCanceled ? '❌' : (isExpired ? '⌛' : '⏳'));
            const statusText = isPaid ? 'Оплачен' : (isCanceled ? 'Отменен' : (isExpired ? 'Истёк' : 'Ожидает оплаты'));
            const date = rawDate
                ? new Date(rawDate).toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' })
                : '—';
            const displayAmount = ord.paidAmount || ord.input?.amountUSD || ord.amount || 0;
            const amount = ord.isFiat ? `${ord.amount}₽` : `${Number(displayAmount).toFixed(2)} USDT`;
            const pkgTitle = ord.package === 'deposit' ? 'Пополнение баланса' : (PACKAGES[ord.package]?.title || ord.package || 'Пополнение');
            const globalIdx = startIdx + idx + 1;
            const payType = ord.isFiat ? 'Банковская карта (Lava)' : `Крипта (${ord.currency || 'USDT'})`;

            message += `${globalIdx}. ${statusEmoji} <b>${pkgTitle}</b> — <b>${amount}</b>\n`;
            message += `   ├ Статус: ${statusText}\n`;
            message += `   ├ Метод: ${payType}\n`;
            message += `   └ 📅 ${date} (МСК)\n\n`;
        });

        const keyboard = {
            inline_keyboard: []
        };

        // Пагинация
        if (totalPages > 1) {
            const navButtons = [];
            if (page > 0) {
                navButtons.push({ text: '⬅️ Назад', callback_data: `profile_transactions:${page - 1}` });
            }
            if (page < totalPages - 1) {
                navButtons.push({ text: 'Вперёд ➡️', callback_data: `profile_transactions:${page + 1}` });
            }
            if (navButtons.length > 0) {
                keyboard.inline_keyboard.push(navButtons);
            }
        }

        // Кнопка быстрой проверки только для АКТИВНЫХ (не истекших, в пределах 30 минут) крипто-заказов
        const pendingCrypto = allOrders.find(o => {
            if (o.isPaid || o.isFiat || !o.orderId) return false;
            if (o.status === 'canceled' || o.status === 'cancelled' || o.output?.status === 'canceled' || o.output?.status === 'cancelled') return false;
            const rawDate = o.createdAt || o.input?.createdAt;
            const orderTime = rawDate ? new Date(rawDate).getTime() : 0;
            const expTime = o.output?.expDate ? new Date(o.output.expDate).getTime() : 0;
            if (expTime > 0 && Date.now() > expTime) return false;
            if (orderTime > 0 && Date.now() - orderTime > 30 * 60 * 1000) return false;
            return true;
        });
        if (pendingCrypto) {
            keyboard.inline_keyboard.push([{
                text: '🔄 Проверить статус крипто-оплаты',
                callback_data: `check_payment_${pendingCrypto.orderId}`
            }]);
        }

        keyboard.inline_keyboard.push([{ text: '🔙 Назад в профиль', callback_data: 'profile' }]);
        keyboard.inline_keyboard.push([{ text: '🏠 Главное меню', callback_data: 'main_menu' }]);

        await ctx.editMessageText(message, {
            parse_mode: 'HTML',
            reply_markup: keyboard
        });
    } catch (err) {
        console.error('❌ Error in handleProfileTransactions:', err);
        await safeAnswerCbQuery(ctx, 'Произошла ошибка');
    }
}

export { handleWithdraw } from '../handlers/user_handlers/user_menu.js';

