import 'dotenv/config';
import express from 'express';
import bodyParser from 'body-parser';
import crypto from 'crypto';
import axios from 'axios';
import { OrderService } from '../services/Order.service.js';
import { UserService } from '../services/User.service.js';
import { ReferralService } from '../services/Referral.service.js';
import { currencyService } from '../services/Currency.service.js';
import { PACKAGES } from '../config.js';
import redis from '../redis.js';

const app = express();
const PORT = process.env.WEBHOOK_PORT || 3000;
const USE_WEBHOOK = process.env.USE_WEBHOOK === 'true';

// Сохраняем сырое тело для HMAC-проверки подписи Lava
const rawBodySaver = (req, res, buf) => { if (buf && buf.length) req.rawBody = buf; };
app.use(bodyParser.json({ verify: rawBodySaver }));
app.use(bodyParser.urlencoded({ extended: true, verify: rawBodySaver }));

const orderService = new OrderService();
const userService = new UserService();
const referralService = new ReferralService();

// Импортируем бота для отправки уведомлений
let bot = null;
let mainBot = null;

if (USE_WEBHOOK) {
    const botModule = await import('../bot_start.js');
    bot = botModule.default;
    console.log('✅ Bot imported for webhook mode');
} else {
    // В polling режиме импортируем Telegraf напрямую
    const { Telegraf } = await import('telegraf');
    mainBot = new Telegraf(process.env.BOT_TOKEN);
    console.log('✅ Main bot instance created for notifications');
}

// Функция проверки подписи от Lava
// Lava.top: HMAC-SHA256 по СЫРОМУ телу запроса, заголовок `signature`, секрет из дашборда Lava.
function verifyLavaSignature(rawBody, signature) {
    const secret = process.env.LAVA_WEBHOOK_SECRET || '';
    if (!secret || !signature) return false;
    const raw = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(String(rawBody || ''), 'utf-8');
    const hash = crypto.createHmac('sha256', secret).update(raw).digest('hex');
    return hash.toLowerCase() === String(signature).toLowerCase();
}

// P0-01: подпись 0xProcessing (payment form): MD5(PaymentId:MerchantId:Email:Currency:WebhookPassword).
// Порядок полей — по докам 0xProcessing; секрет = "Webhook Password" из кабинета.
// ⚠️ Точную строку (пробелы/ShopId/значение Currency) ОБЯЗАТЕЛЬНО провалидировать реальным вебхуком на стейдже до включения enforcement.
function verifyCryptoSignature(body, signature) {
    const secret = process.env.WEBHOOK_PASSWORD_PROCESSING || process.env.PROCESSING_SECRET_KEY || '';
    if (!secret || !signature) return false;
    const PaymentId = body.PaymentId || body.paymentId || body.uid || body.id || '';
    const MerchantId = body.MerchantId || body.merchantId || body.merchantID || '';
    const Email = body.Email || body.email || '';
    const Currency = body.Currency || body.currency || '';
    const raw = `${PaymentId}:${MerchantId}:${Email}:${Currency}:${secret}`;
    const hash = crypto.createHash('md5').update(raw).digest('hex');
    return hash.toLowerCase() === String(signature).toLowerCase();
}

// Включает fail-closed аутентификацию вебхуков (P0-01/P0-02).
// По умолчанию OFF, чтобы не сломать прод до настройки секретов/схемы у провайдеров.
const WEBHOOK_ENFORCE_AUTH = process.env.WEBHOOK_ENFORCE_AUTH === 'true';

// P2-14: не логировать секретные заголовки.
const SENSITIVE_HEADERS = ['authorization', 'x-signature', 'x-lava-signature', 'signature', 'cookie'];
function redactHeaders(headers = {}) {
    const out = {};
    for (const [k, v] of Object.entries(headers)) {
        out[k] = SENSITIVE_HEADERS.includes(String(k).toLowerCase()) ? '***REDACTED***' : v;
    }
    return out;
}

// URL соседнего контура (стейдж -> прод или прод -> стейдж)
const isStagingEnv = process.env.NODE_ENV === 'staging' || process.env.BOT_NAME === 'meemee_official_bot';
const PEER_BACKEND_URL = process.env.PEER_BACKEND_URL || (isStagingEnv ? 'http://viralapp-backend:3005' : 'http://viralapp-staging-backend:3005');
// P1-06: кросс-средовой форвардинг вебхуков выключен по умолчанию (включать осознанно).
const PEER_FORWARD_ENABLED = process.env.PEER_FORWARD_ENABLED === 'true';

// Проксирование вебхука в соседний бэкенд, если заказ не найден локально
async function forwardWebhookToPeer(req, res, peerUrl) {
    try {
        const targetUrl = `${peerUrl}${req.originalUrl || req.url}`;
        console.log(`🔀 Order not found locally. Forwarding webhook to peer: ${targetUrl}`);
        const forwardHeaders = {
            'content-type': 'application/json',
            'x-peer-forwarded': 'true'
        };
        if (req.headers['authorization']) {
            forwardHeaders['authorization'] = req.headers['authorization'];
        }
        if (req.headers['x-signature']) {
            forwardHeaders['x-signature'] = req.headers['x-signature'];
        }
        if (req.headers['x-lava-signature']) {
            forwardHeaders['x-lava-signature'] = req.headers['x-lava-signature'];
        }
        if (req.headers['x-forwarded-for']) {
            forwardHeaders['x-forwarded-for'] = req.headers['x-forwarded-for'];
        }

        const peerRes = await axios.post(targetUrl, req.body, {
            headers: forwardHeaders,
            timeout: 10000,
            validateStatus: () => true
        });

        console.log(`🔀 Peer responded: status=${peerRes.status}`);
        if (peerRes.status >= 200 && peerRes.status < 300) {
            return res.status(peerRes.status).json(peerRes.data);
        }
        return res.status(200).json({ success: true, message: 'Forwarded to peer, order not found on both nodes, acknowledged' });
    } catch (err) {
        console.error(`⚠️ Failed to forward webhook to peer ${peerUrl}:`, err.message);
        return res.status(200).json({ success: true, message: 'Peer forwarding failed, acknowledged' });
    }
}

// Уведомление рефереров о начислении кешбэка
async function notifyCashbackRecipients(botInstance, cashbackResults) {
    if (!botInstance || !Array.isArray(cashbackResults)) return;
    for (const item of cashbackResults) {
        try {
            const expertUser = await userService.getUser(item.expertId);
            const lineText = item.level === 1 ? '1-й линии' : '2-й линии';
            await botInstance.telegram.sendMessage(
                item.expertId,
                `💰 <b>Начислен партнерский кешбэк!</b>\n\n` +
                `👤 Пользователь ${lineText} совершил пополнение.\n` +
                `💵 Сумма: <b>${Number(item.originalAmount || 0).toFixed(2)} USDT</b>\n` +
                `🎁 Ваш бонус (${item.percent}%): <b>+${Number(item.amount || 0).toFixed(2)} USDT</b>\n\n` +
                `📊 Всего заработано: <b>${Number(expertUser?.totalCashback || 0).toFixed(2)} USDT</b>`,
                { parse_mode: 'HTML' }
            );
            console.log(`✅ Cashback notification sent to expert ${item.expertId}`);
        } catch (notifyErr) {
            console.warn(`Failed to notify expert ${item.expertId}:`, notifyErr.message);
        }
    }
}

// Webhook для Lava (фиат платежи)
app.post(['/webhook/lava', '/webhook/staging/lava', '/staging/webhook/lava'], async (req, res) => {
    try {
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📥 Lava webhook received at:', new Date().toISOString());
        console.log('📦 Full webhook data:', JSON.stringify(req.body, null, 2));
        console.log('📋 Headers:', JSON.stringify(redactHeaders(req.headers), null, 2));
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

        // Извлекаем данные из webhook (поддерживаем форматы Lava v1/v2/v3)
        const eventType = req.body.eventType || req.body.event || req.body.type;
        const status = req.body.status;
        const email = req.body.buyer?.email || req.body.email;
        const contractId = req.body.contractId || req.body.contract_id;
        const invoiceId = req.body.invoiceId || req.body.invoice_id || req.body.id || contractId;
        const orderId = req.body.orderId || req.body.order_id;

        console.log(`📊 Extracted: eventType=${eventType}, status=${status}, email=${email}, invoiceId=${invoiceId}, orderId=${orderId}`);

        // Проверка Basic Auth от Lava (если настроены учетные данные)
        let authPassed = false;
        const authHeader = req.headers['authorization'];
        if (process.env.LAVA_WEBHOOK_USER && process.env.LAVA_WEBHOOK_PASSWORD) {
            if (!authHeader || !authHeader.startsWith('Basic ')) {
                console.error('❌ Missing or invalid Authorization header in Lava webhook');
                return res.status(401).json({ error: 'Unauthorized: missing basic auth' });
            }
            const credentials = Buffer.from(authHeader.split(' ')[1], 'base64').toString('utf-8');
            const [user, pass] = credentials.split(':');
            if (user !== process.env.LAVA_WEBHOOK_USER || pass !== process.env.LAVA_WEBHOOK_PASSWORD) {
                console.error('❌ Invalid Basic Auth credentials in Lava webhook');
                return res.status(401).json({ error: 'Unauthorized: invalid credentials' });
            }
            console.log('🔐 Lava Basic Auth verified successfully');
            authPassed = true;
        }

        // Проверка подписи Lava (HMAC-SHA256 по сырому телу, заголовок `signature`)
        const signature = req.headers['signature'] || req.headers['x-signature'] || req.headers['x-lava-signature'];
        if (signature && process.env.LAVA_WEBHOOK_SECRET) {
            const isValid = verifyLavaSignature(req.rawBody, signature);
            console.log(`🔐 Lava signature verification: ${isValid ? '✅ Valid' : '❌ Invalid'}`);
            if (!isValid) {
                console.error('❌ Invalid Lava signature');
                return res.status(403).json({ error: 'Invalid signature' });
            }
            authPassed = true;
        } else {
            console.log('⚠️ Lava signature check skipped (header missing or LAVA_WEBHOOK_SECRET not set)');
        }

        // P0-02: fail-closed при включённом WEBHOOK_ENFORCE_AUTH
        if (WEBHOOK_ENFORCE_AUTH && !authPassed) {
            console.error('❌ Lava webhook rejected: enforcement on, no valid auth/signature');
            return res.status(401).json({ error: 'Unauthorized' });
        }

        // Поиск заказа: по orderId, затем по invoiceId (parentId), затем по email
        let order = null;
        if (orderId) {
            order = await orderService.getOrderById(orderId);
            if (order) console.log(`🔍 Order found by orderId: ${orderId}`);
        }
        if (!order && invoiceId) {
            order = await orderService.getOrderByParentId(invoiceId);
            if (order) console.log(`🔍 Order found by parent invoiceId: ${invoiceId}`);
        }

        if (!order) {
            console.warn('⚠️ Lava order not found locally:', { orderId, invoiceId });
            if (PEER_FORWARD_ENABLED && PEER_BACKEND_URL && !req.headers['x-peer-forwarded']) {
                return await forwardWebhookToPeer(req, res, PEER_BACKEND_URL);
            }
            return res.status(200).json({ success: true, message: 'Order not found, acknowledged' });
        }

        console.log(`📦 Order found: orderId=${order.orderId}, userId=${order.userId}, package=${order.package}, isPaid=${order.isPaid}`);

        if (order.isPaid) {
            console.log('ℹ️ Order already paid:', order.orderId);
            return res.status(200).json({ success: true, message: 'Already paid' });
        }

        // Обрабатываем успешный платеж
        const isSuccess = (
            eventType === 'payment.success' ||
            (status && (
                status.toLowerCase() === 'success' || 
                status.toLowerCase() === 'paid' || 
                status.toLowerCase() === 'completed'
            ))
        );

        console.log(`💰 Payment status check: eventType=${eventType}, status=${status}, isSuccess=${isSuccess}`);

        if (isSuccess) {
            console.log('✅ Processing successful fiat payment:', order.orderId);

            // P0-03: атомарный идемпотентный claim (защита от дублей/гонок)
            const claimed = await orderService.tryClaimForPayment(order.orderId);
            if (!claimed) {
                console.log(`⚠️ Order ${order.orderId} already claimed, skipping crediting.`);
                return res.json({ status: 'already_processed', orderId: order.orderId });
            }
            await orderService.markAsPaid(order.orderId);

            // Проверяем что пакет существует, либо депозит
            const pkg = PACKAGES[order.package];
            let depositUsd = 0;

            if (pkg) {
                console.log(`💳 Adding ${pkg.generations} videos to user ${order.userId}`);
                await userService.addPaidQuota(order.userId, pkg.generations);
                console.log(`✅ Successfully added ${pkg.generations} videos to user ${order.userId}`);
            } else {
                const rubAmount = Number(order.amount || req.body.amount || req.body.buyer?.amount || 500);
                const conversion = await currencyService.rubToUsdFloor(rubAmount);
                depositUsd = conversion.usd;
                console.log(`💰 Adding ${depositUsd} USDT (CBR rate: ${conversion.rate}) to user ${order.userId}`);
                await userService.addWalletBalance(order.userId, depositUsd);
                console.log(`✅ Successfully added ${depositUsd} USDT to user ${order.userId}`);
            }

            // Обрабатываем кешбэк для эксперта
            try {
                const cashbackBase = pkg ? Number(pkg.usdt || 0) : depositUsd; // P1-08: база кешбэка в USD
                const cashbackResults = await referralService.processExpertCashback(order.userId, cashbackBase);
                console.log('✅ Cashback processed:', cashbackResults);
                const botInstance = bot || mainBot;
                await notifyCashbackRecipients(botInstance, cashbackResults);
            } catch (cashbackErr) {
                console.error('⚠️ Cashback processing failed:', cashbackErr.message);
            }

            // Отправляем уведомление пользователю
            try {
                const botInstance = bot || mainBot;
                if (botInstance) {
                    const message = pkg
                        ? `✅ Оплата успешно получена!\n\n` +
                          `${pkg.emoji} ${pkg.title}\n` +
                          `💎 Добавлено генераций: ${pkg.generations}\n\n` +
                          `Теперь вы можете создавать видео!`
                        : `✅ Пополнение баланса картой успешно!\n\n` +
                          `💰 На ваш баланс зачислено: <b>${depositUsd.toFixed(2)} USDT</b>\n\n` +
                          `Теперь вы можете создавать видео!`;
                    
                    await botInstance.telegram.sendMessage(order.userId, message, {
                        parse_mode: 'HTML',
                        reply_markup: {
                            inline_keyboard: [
                                [{ text: '🎬 Создать видео', callback_data: 'catalog' }],
                                [{ text: '👤 Личный кабинет', callback_data: 'profile' }]
                            ]
                        }
                    });
                    console.log(`✅ Notification sent to user ${order.userId}`);
                }
            } catch (notifyErr) {
                console.error('⚠️ Failed to send notification:', notifyErr.message);
            }

            res.status(200).json({ success: true, message: 'Payment processed' });
        } else {
            console.log('ℹ️ Fiat payment status (not success):', status);
            res.status(200).json({ success: true, message: 'Status noted' });
        }
    } catch (err) {
        console.error('❌ Error in Lava webhook:', err);
        console.error('Stack:', err.stack);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Webhook для Telegram бота
if (USE_WEBHOOK && bot) {
    const WEBHOOK_PATH = process.env.WEBHOOK_PATH || '/bot-webhook';
    
    app.post(WEBHOOK_PATH, async (req, res) => {
        try {
            await bot.handleUpdate(req.body);
            res.sendStatus(200);
        } catch (err) {
            console.error('❌ Error handling bot webhook:', err);
            res.sendStatus(500);
        }
    });
    
    console.log(`✅ Bot webhook endpoint: ${WEBHOOK_PATH}`);
}

// Webhook для 0xprocessing (крипто платежи)
app.post(['/webhook/crypto', '/webhook/staging/crypto', '/staging/webhook/crypto'], async (req, res) => {
    try {
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📥 Crypto webhook received at:', new Date().toISOString());
        console.log('📦 Full webhook data:', JSON.stringify(req.body, null, 2));
        console.log('📋 Headers:', JSON.stringify(redactHeaders(req.headers), null, 2));
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

        // 0xProcessing может отправлять разные поля
        const billingID = req.body.billingID || req.body.BillingID || req.body.billing_id || req.body.BillingId || req.body.orderId || req.body.order_id;
        const status = req.body.status || req.body.Status;
        const paymentId = req.body.PaymentId || req.body.paymentId || req.body.uid || req.body.id;
        const clientId = req.body.clientId || req.body.ClientId || req.body.userId || req.body.UserId;
        const email = req.body.email || req.body.Email;
        const address = req.body.address || req.body.Address || req.body.wallet;
        const amountUSD = Number(req.body.TotalAmountUSD || req.body.totalAmountUSD || req.body.TotalAmount || req.body.totalAmount || req.body.AmountUSD || req.body.amountUSD || req.body.Amount || req.body.amount || 0);

        console.log(`🔍 Extracted fields: billingID=${billingID}, status=${status}, paymentId=${paymentId}, clientId=${clientId}, email=${email}, address=${address}, amountUSD=${amountUSD}`);

        // P0-01: проверка подписи 0xProcessing (fail-closed при WEBHOOK_ENFORCE_AUTH)
        {
            const providedSig = req.body.Signature || req.body.signature || req.body.Sign || req.headers['x-signature'];
            const sigOk = verifyCryptoSignature(req.body, providedSig);
            if (WEBHOOK_ENFORCE_AUTH && !sigOk) {
                console.error('❌ Crypto webhook rejected: invalid/missing signature (enforcement on)');
                return res.status(403).json({ error: 'Invalid signature' });
            }
            console.log(`🔐 Crypto signature check: ${sigOk ? '✅ Valid' : '❌ Invalid/absent'} (enforcement ${WEBHOOK_ENFORCE_AUTH ? 'ON' : 'OFF'})`);
        }

        let order = null;
        if (billingID) {
            order = await orderService.getOrderById(billingID);
            if (order) console.log(`🔍 Crypto order found by billingID: ${billingID}`);
        }
        if (!order && paymentId) {
            order = await orderService.getOrderByParentId(paymentId);
            if (order) console.log(`🔍 Crypto order found by paymentId/UID: ${paymentId}`);
        }
        if (!order && address) {
            order = await orderService.getOrderByAddress(address);
            if (order) console.log(`🔍 Crypto order found by address: ${address}`);
        }

        if (!order) {
            console.warn('⚠️ Crypto order not found locally:', { billingID, paymentId, address });
            if (PEER_FORWARD_ENABLED && PEER_BACKEND_URL && !req.headers['x-peer-forwarded']) {
                return await forwardWebhookToPeer(req, res, PEER_BACKEND_URL);
            }
            return res.status(200).json({ success: true, message: 'Order not found, acknowledged' });
        }

        const effectiveOrderId = order.orderId;
        console.log(`📦 Order found: orderId=${effectiveOrderId}, userId=${order.userId}, package=${order.package}, isPaid=${order.isPaid}`);

        if (order.isPaid) {
            console.log('ℹ️ Order already paid:', effectiveOrderId);
            return res.status(200).json({ success: true, message: 'Already paid' });
        }

        // Обрабатываем успешный платеж
        const isSuccess = status && (
            status.toLowerCase() === 'success' || 
            status.toLowerCase() === 'paid' || 
            status.toLowerCase() === 'completed'
        );

        if (isSuccess) {
            console.log('✅ Processing successful crypto payment:', effectiveOrderId);

            // P0-03: атомарный идемпотентный claim
            const claimed = await orderService.tryClaimForPayment(effectiveOrderId);
            if (!claimed) {
                console.log(`⚠️ Crypto order ${effectiveOrderId} already claimed, skipping crediting.`);
                return res.json({ status: 'already_processed', orderId: effectiveOrderId });
            }

            // P0-01/P0-04: НЕ доверяем сумме из тела вебхука — начисляем сумму заказа.
            const depositAmount = Number(order.amount || 0);
            if (amountUSD > 0 && Math.abs(amountUSD - depositAmount) > 0.01) {
                console.warn(`⚠️ Webhook amountUSD=${amountUSD} != order.amount=${depositAmount}; crediting order.amount.`);
            }
            console.log(`📊 Order details: userId=${order.userId}, package=${order.package}, amount=${depositAmount}`);

            await orderService.markAsPaid(effectiveOrderId, {
                paidAmount: depositAmount,
                status: 'success'
            });

            const pkg = PACKAGES[order.package];
            if (pkg) {
                // P1-07: пакет начисляет ТОЛЬКО генерации (без доп. баланса)
                console.log(`💳 Adding ${pkg.generations} videos to user ${order.userId}`);
                await userService.addPaidQuota(order.userId, pkg.generations);
                console.log(`✅ Successfully added ${pkg.generations} videos to user ${order.userId}`);
            } else {
                console.log(`💰 Adding ${depositAmount} USDT wallet balance to user ${order.userId}`);
                await userService.addWalletBalance(order.userId, depositAmount);
                console.log(`✅ Successfully added ${depositAmount} USDT wallet balance to user ${order.userId}`);
            }

            // Обрабатываем кешбэк для реферала
            try {
                const cashbackResults = await referralService.processExpertCashback(order.userId, pkg ? Number(pkg.usdt || 0) : depositAmount); // P1-08
                console.log('✅ Cashback processed:', cashbackResults);
                const botInstance = bot || mainBot;
                await notifyCashbackRecipients(botInstance, cashbackResults);
            } catch (cashbackErr) {
                console.error('⚠️ Cashback processing failed:', cashbackErr.message);
            }

            // Отправляем уведомление пользователю
            try {
                const botInstance = bot || mainBot;
                if (botInstance) {
                    const message = pkg
                        ? `✅ <b>Криптоплатеж успешно получен!</b>\n\n` +
                          `${pkg.emoji} ${pkg.title}\n` +
                          `💎 Добавлено генераций: ${pkg.generations}\n` +
                          `💰 Пополнен баланс: +${depositAmount.toFixed(2)} USDT\n\n` +
                          `Теперь вы можете создавать видео!`
                        : `✅ <b>Криптодепозит успешно зачислен!</b>\n\n` +
                          `💰 На ваш баланс зачислено: <b>${depositAmount.toFixed(2)} USDT</b>\n\n` +
                          `Теперь вы можете создавать видео!`;
                    
                    await botInstance.telegram.sendMessage(order.userId, message, {
                        parse_mode: 'HTML',
                        reply_markup: {
                            inline_keyboard: [
                                [{ text: '🎬 Создать видео', callback_data: 'catalog' }],
                                [{ text: '👤 Личный кабинет', callback_data: 'profile' }]
                            ]
                        }
                    });
                    console.log(`✅ Notification sent to user ${order.userId}`);
                } else {
                    console.log('⚠️ Bot instance not available for notifications');
                }
            } catch (notifyErr) {
                console.error('⚠️ Failed to send notification:', notifyErr.message);
            }

            return res.status(200).json({ success: true, message: 'Payment processed' });
        } else {
            console.log('ℹ️ Crypto payment status (not success):', status);
            const isCanceled = status && (status.toLowerCase() === 'canceled' || status.toLowerCase() === 'cancelled');
            if (isCanceled && effectiveOrderId) {
                await orderService.updateOrder(effectiveOrderId, { status: 'canceled' });
                console.log(`❌ Order ${effectiveOrderId} marked as canceled`);
            }
            return res.status(200).json({ success: true, message: 'Status noted' });
        }
    } catch (err) {
        console.error('❌ Error in crypto webhook:', err);
        console.error('Stack:', err.stack);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Health check
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});
// GET endpoints для проверки webhook'ов (для браузера)
app.get('/webhook/lava', (req, res) => {
    res.status(200).json({ 
        status: 'ready', 
        message: 'Lava webhook is ready to receive POST requests',
        endpoint: '/webhook/lava',
        method: 'POST'
    });
});

app.get('/webhook/crypto', (req, res) => {
    res.status(200).json({ 
        status: 'ready', 
        message: 'Crypto webhook is ready to receive POST requests',
        endpoint: '/webhook/crypto',
        method: 'POST'
    });
});

// GET /webhook/analytics/clicks — отдача статистики кликов для интерактивной доски (TASK-21)
app.get(['/webhook/analytics/clicks', '/webhook/staging/analytics/clicks', '/staging/webhook/analytics/clicks', '/api/analytics/clicks'], async (req, res) => {
    try {
        // P2-14: если ANALYTICS_TOKEN задан — требуем его; если не задан — доска открыта (вариант A).
        const analyticsToken = process.env.ANALYTICS_TOKEN;
        if (analyticsToken && req.query.token !== analyticsToken && req.headers['x-analytics-token'] !== analyticsToken) {
            return res.status(404).json({ error: 'Not found' });
        }
        const today = new Date().toISOString().split('T')[0];
        const [totalMap, dailyMap, totalClicksCount, uniqueUsersCount] = await Promise.all([
            redis.hgetall('analytics:clicks:total'),
            redis.hgetall(`analytics:clicks:daily:${today}`),
            redis.hget('analytics:clicks:summary', 'total_clicks'),
            redis.pfcount('analytics:clicks:hll:users')
        ]);

        const buttons = Object.entries(totalMap || {})
            .map(([callback, count]) => ({ callback, count: parseInt(count, 10) || 0 }))
            .sort((a, b) => b.count - a.count);

        const getClicks = (keyPattern) => {
            return buttons
                .filter(b => b.callback.includes(keyPattern))
                .reduce((acc, b) => acc + b.count, 0);
        };

        const funnel = {
            create_video: getClicks('create_video'),
            catalog: getClicks('catalog'),
            cheburashka: getClicks('cheburashka'),
            buy: getClicks('buy'),
            card: getClicks('pay_card'),
            crypto: getClicks('pay_crypto'),
            profile: getClicks('profile'),
            referral: getClicks('referral')
        };

        res.json({
            status: 'ok',
            updatedAt: new Date().toISOString(),
            totalClicks: parseInt(totalClicksCount, 10) || buttons.reduce((acc, b) => acc + b.count, 0),
            uniqueUsers: uniqueUsersCount || 0,
            funnel,
            topButtons: buttons.slice(0, 25),
            allButtons: totalMap || {},
            daily: {
                date: today,
                buttons: dailyMap || {}
            }
        });
    } catch (err) {
        console.error('❌ Error fetching click analytics:', err);
        res.status(500).json({ error: 'Failed to fetch analytics' });
    }
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err, req, res, _next) => {
    console.error('❌ Server error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

// Функция для установки webhook
async function setupWebhook() {
    if (USE_WEBHOOK && bot) {
        try {
            const WEBHOOK_DOMAIN = process.env.WEBHOOK_DOMAIN;
            const WEBHOOK_PATH = process.env.WEBHOOK_PATH || '/bot-webhook';
            
            if (!WEBHOOK_DOMAIN || WEBHOOK_DOMAIN === 'https://your-domain.com') {
                console.log('⚠️  WEBHOOK_DOMAIN not configured, skipping webhook setup');
                console.log('⚠️  Bot will work in local mode only');
                return;
            }
            
            const webhookUrl = `${WEBHOOK_DOMAIN}${WEBHOOK_PATH}`;
            await bot.telegram.setWebhook(webhookUrl);
            console.log(`✅ Telegram webhook set to: ${webhookUrl}`);
        } catch (err) {
            console.error('❌ Failed to set webhook:', err.message);
        }
    }
}

// Start server
app.listen(PORT, async () => {
    console.log(`✅ Webhook server started on port ${PORT}`);
    const webhookDomain = process.env.WEBHOOK_DOMAIN || `http://localhost:${PORT}`;
    console.log(`📍 Lava webhook: ${webhookDomain}/webhook/lava`);
    console.log(`📍 Crypto webhook: ${webhookDomain}/webhook/crypto`);
    
    if (USE_WEBHOOK) {
        const WEBHOOK_PATH = process.env.WEBHOOK_PATH || '/bot-webhook';
        console.log(`Bot webhook: http://localhost:${PORT}${WEBHOOK_PATH}`);
        await setupWebhook();
    }
});

export default app;
