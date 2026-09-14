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

const app = express();
const PORT = process.env.WEBHOOK_PORT || 3000;
const USE_WEBHOOK = process.env.USE_WEBHOOK === 'true';

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

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
function verifyLavaSignature(data, signature) {
    const secret = process.env.WEBHOOK_PASSWORD_PROCESSING || '';
    const hash = crypto
        .createHash('md5')
        .update(JSON.stringify(data) + secret)
        .digest('hex');
    return hash === signature;
}

// URL соседнего контура (стейдж -> прод или прод -> стейдж)
const isStagingEnv = process.env.NODE_ENV === 'staging' || process.env.BOT_NAME === 'meemee_official_bot';
const PEER_BACKEND_URL = process.env.PEER_BACKEND_URL || (isStagingEnv ? 'http://viralapp-backend:3005' : 'http://viralapp-staging-backend:3005');

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
        console.log('📋 Headers:', JSON.stringify(req.headers, null, 2));
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
        }

        // Проверка подписи (если используется и настроен секрет)
        const signature = req.headers['x-signature'] || req.headers['x-lava-signature'] || req.headers['signature'];
        if (signature && process.env.WEBHOOK_PASSWORD_PROCESSING) {
            const isValid = verifyLavaSignature(req.body, signature);
            console.log(`🔐 Signature verification: ${isValid ? '✅ Valid' : '❌ Invalid'}`);
            if (!isValid) {
                console.error('❌ Invalid Lava signature');
                return res.status(403).json({ error: 'Invalid signature' });
            }
        } else {
            console.log('⚠️ Signature check skipped (header missing or secret not configured)');
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
        if (!order && email) {
            order = await orderService.getOrderByEmail(email);
            if (order) console.log(`🔍 Order found by email: ${email}`);
        }

        if (!order) {
            console.warn('⚠️ Lava order not found locally:', { orderId, invoiceId, email });
            if (PEER_BACKEND_URL && !req.headers['x-peer-forwarded']) {
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

            if (order.isPaid) {
                console.log(`⚠️ Order ${order.orderId} already marked as paid, skipping crediting.`);
                return res.json({ status: 'already_processed', orderId: order.orderId });
            }

            // Отмечаем заказ как оплаченный
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
                const cashbackBase = depositUsd > 0 ? depositUsd : order.amount;
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
        console.log('📋 Headers:', JSON.stringify(req.headers, null, 2));
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
        if (!order && email) {
            order = await orderService.getOrderByEmail(email);
            if (order) console.log(`🔍 Crypto order found by email: ${email}`);
        }
        if (!order && clientId) {
            const userOrders = await orderService.getUserOrders(clientId);
            order = userOrders.find(o => !o.isPaid && !o.isFiat);
            if (order) console.log(`🔍 Crypto order found by user pending order: ${order.orderId}`);
        }
        if (!order) {
            console.warn('⚠️ Crypto order not found locally:', { billingID, paymentId, clientId, email, address });
            if (PEER_BACKEND_URL && !req.headers['x-peer-forwarded']) {
                return await forwardWebhookToPeer(req, res, PEER_BACKEND_URL);
            }
        }

        if (!order && clientId) {
            console.log(`⚠️ Creating fallback crypto order for user ${clientId}`);
            order = {
                orderId: `crypto_webhook_${Date.now()}_${clientId}`,
                userId: parseInt(clientId),
                package: 'deposit',
                amount: amountUSD > 0 ? amountUSD : 2.0,
                isPaid: false,
                isFiat: false
            };
            await orderService.createOrder(order);
        }

        if (!order) {
            console.warn('⚠️ Crypto order not found for params:', { billingID, paymentId, clientId, email, address });
            // Возвращаем 200 OK, чтобы 0xProcessing не долбил ретраями и не слал алерты
            return res.status(200).json({ success: true, message: 'Order not found or canceled, acknowledged' });
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

            if (order.isPaid) {
                console.log(`⚠️ Crypto order ${effectiveOrderId} already marked as paid, skipping crediting.`);
                return res.json({ status: 'already_processed', orderId: effectiveOrderId });
            }

            const depositAmount = amountUSD > 0 ? amountUSD : Number(order.amount || 2.0);
            console.log(`📊 Order details: userId=${order.userId}, package=${order.package}, amount=${depositAmount}`);

            await orderService.markAsPaid(effectiveOrderId, {
                paidAmount: depositAmount,
                status: 'success'
            });

            const pkg = PACKAGES[order.package];
            if (pkg) {
                console.log(`💳 Adding ${pkg.generations} videos to user ${order.userId}`);
                await userService.addPaidQuota(order.userId, pkg.generations);
                await userService.addWalletBalance(order.userId, depositAmount);
                console.log(`✅ Successfully added ${pkg.generations} videos and ${depositAmount} USDT to user ${order.userId}`);
            } else {
                console.log(`💰 Adding ${depositAmount} USDT wallet balance to user ${order.userId}`);
                await userService.addWalletBalance(order.userId, depositAmount);
                console.log(`✅ Successfully added ${depositAmount} USDT wallet balance to user ${order.userId}`);
            }

            // Обрабатываем кешбэк для реферала
            try {
                const cashbackResults = await referralService.processExpertCashback(order.userId, depositAmount);
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
