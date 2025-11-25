import 'dotenv/config';
import express from 'express';
import bodyParser from 'body-parser';
import crypto from 'crypto';
import { OrderService } from '../services/Order.service.js';
import { UserService } from '../services/User.service.js';
import { ReferralService } from '../services/Referral.service.js';
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

// Webhook для Lava (фиат платежи)
app.post('/webhook/lava', async (req, res) => {
    try {
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📥 Lava webhook received at:', new Date().toISOString());
        console.log('📦 Full webhook data:', JSON.stringify(req.body, null, 2));
        console.log('📋 Headers:', JSON.stringify(req.headers, null, 2));
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

        // Извлекаем данные из webhook (новый формат Lava)
        const eventType = req.body.eventType;
        const status = req.body.status;
        const email = req.body.buyer?.email;
        const contractId = req.body.contractId;

        console.log(`📊 Extracted: eventType=${eventType}, status=${status}, email=${email}, contractId=${contractId}`);

        // Проверка подписи (если используется)
        const signature = req.headers['x-signature'];
        if (signature) {
            const isValid = verifyLavaSignature(req.body, signature);
            console.log(`🔐 Signature verification: ${isValid ? '✅ Valid' : '❌ Invalid'}`);
            if (!isValid) {
                console.error('❌ Invalid Lava signature');
                return res.status(403).json({ error: 'Invalid signature' });
            }
        } else {
            console.log('⚠️ No signature provided');
        }

        if (!email) {
            console.error('❌ No email in webhook data');
            return res.status(400).json({ error: 'Email required' });
        }

        // Находим заказ по email
        console.log(`🔍 Searching for order with email: ${email}`);
        const order = await orderService.getOrderByEmail(email);
        if (!order) {
            console.error('❌ Order not found for email:', email);
            return res.status(404).json({ error: 'Order not found' });
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

            // Отмечаем заказ как оплаченный
            await orderService.markAsPaid(order.orderId);

            // Проверяем что пакет существует
            const pkg = PACKAGES[order.package];
            if (!pkg) {
                console.error(`❌ Package not found: ${order.package}`);
                console.error(`Available packages: ${Object.keys(PACKAGES).join(', ')}`);
                return res.status(400).json({ error: 'Package not found' });
            }

            // Добавляем генерации
            console.log(`💳 Adding ${pkg.generations} videos to user ${order.userId}`);
            const addResult = await userService.addPaidQuota(order.userId, pkg.generations);

            if (!addResult) {
                console.error(`❌ Failed to add quota to user ${order.userId}`);
                return res.status(500).json({ error: 'Failed to add quota' });
            }

            console.log(`✅ Successfully added ${pkg.generations} videos to user ${order.userId}`);

            // Обрабатываем кешбэк для эксперта
            try {
                await referralService.processExpertCashback(order.userId, order.amount);
                console.log('✅ Cashback processed');
            } catch (cashbackErr) {
                console.error('⚠️ Cashback processing failed:', cashbackErr.message);
                // Не фейлим весь webhook из-за кешбека
            }

            // Отправляем уведомление пользователю
            try {
                const botInstance = bot || mainBot;
                if (botInstance) {
                    const message = `✅ Оплата успешно получена!\n\n` +
                        `${pkg.emoji} ${pkg.title}\n` +
                        `💎 Добавлено генераций: ${pkg.generations}\n\n` +
                        `Теперь вы можете создавать видео!`;
                    
                    await botInstance.telegram.sendMessage(order.userId, message, {
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
                // Не фейлим весь webhook из-за уведомления
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
app.post('/webhook/crypto', async (req, res) => {
    try {
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📥 Crypto webhook received at:', new Date().toISOString());
        console.log('📦 Full webhook data:', JSON.stringify(req.body, null, 2));
        console.log('📋 Headers:', JSON.stringify(req.headers, null, 2));
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

        // 0xProcessing может отправлять разные поля
        // Поддерживаем оба варианта: BillingID и billingID
        const billingID = req.body.billingID || req.body.BillingID;
        const status = req.body.status || req.body.Status;
        const paymentId = req.body.PaymentId || req.body.paymentId;

        console.log(`🔍 Extracted fields: billingID=${billingID}, status=${status}, paymentId=${paymentId}`);

        if (!billingID) {
            console.error('❌ No billingID in webhook');
            return res.status(400).json({ error: 'Missing billingID' });
        }

        const order = await orderService.getOrderById(billingID);
        if (!order) {
            console.error('❌ Order not found:', billingID);
            return res.status(404).json({ error: 'Order not found' });
        }

        console.log(`📦 Order found: userId=${order.userId}, package=${order.package}, isPaid=${order.isPaid}`);

        if (order.isPaid) {
            console.log('ℹ️ Order already paid:', billingID);
            return res.status(200).json({ success: true, message: 'Already paid' });
        }

        // Обрабатываем успешный платеж
        // Проверяем разные варианты статуса (Success, success, paid)
        const isSuccess = status && (
            status.toLowerCase() === 'success' || 
            status.toLowerCase() === 'paid' || 
            status.toLowerCase() === 'completed'
        );

        if (isSuccess) {
            console.log('✅ Processing successful crypto payment:', billingID);
            console.log(`📊 Order details: userId=${order.userId}, package=${order.package}, amount=${order.amount}`);

            await orderService.markAsPaid(billingID);

            const pkg = PACKAGES[order.package];
            if (!pkg) {
                console.error(`❌ Package not found: ${order.package}`);
                console.error(`Available packages: ${Object.keys(PACKAGES).join(', ')}`);
                return res.status(400).json({ error: 'Package not found' });
            }

            // ИСПРАВЛЕНО: используем order.userId вместо clientId из webhook
            console.log(`💳 Adding ${pkg.generations} videos to user ${order.userId}`);
            const addResult = await userService.addPaidQuota(order.userId, pkg.generations);
            
            if (!addResult) {
                console.error(`❌ Failed to add quota to user ${order.userId}`);
                return res.status(500).json({ error: 'Failed to add quota' });
            }

            console.log(`✅ Successfully added ${pkg.generations} videos to user ${order.userId}`);

            // Обрабатываем кешбэк для реферала
            try {
                await referralService.processExpertCashback(order.userId, order.amount);
                console.log('✅ Cashback processed');
            } catch (cashbackErr) {
                console.error('⚠️ Cashback processing failed:', cashbackErr.message);
                // Не фейлим весь webhook из-за кешбека
            }

            // Отправляем уведомление пользователю
            try {
                const botInstance = bot || mainBot;
                if (botInstance) {
                    const message = `✅ Криптоплатеж успешно получен!\n\n` +
                        `${pkg.emoji} ${pkg.title}\n` +
                        `💎 Добавлено генераций: ${pkg.generations}\n\n` +
                        `Теперь вы можете создавать видео!`;
                    
                    await botInstance.telegram.sendMessage(order.userId, message, {
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
                // Не фейлим весь webhook из-за уведомления
            }

            res.status(200).json({ success: true, message: 'Payment processed' });
        } else {
            console.log('ℹ️ Crypto payment status (not success):', status);
            res.status(200).json({ success: true, message: 'Status noted' });
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
app.use((err, req, res, next) => {
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
