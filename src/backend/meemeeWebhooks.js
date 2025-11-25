/**
 * MeeMee Webhook Handlers
 * Обработчики вебхуков для MeeMee бота
 */

import crypto from 'crypto';
import { OrderService as MeeMeeOrderService } from '../services/Order.service.js';
import { UserService as MeeMeeUserService } from '../services/User.service.js';
import { ReferralService as MeeMeeReferralService } from '../services/Referral.service.js';
import { Telegraf } from 'telegraf';
import 'dotenv/config';

// Инициализация сервисов MeeMee
const meeMeeOrderService = new MeeMeeOrderService();
const meeMeeUserService = new MeeMeeUserService();
const meeMeeReferralService = new MeeMeeReferralService();

// Инициализация бота MeeMee
const meeMeeBot = new Telegraf(process.env.BOT_TOKEN);

// Функция проверки подписи Lava
function verifyLavaSignature(data, signature) {
    const secret = process.env.LAVA_SECRET_KEY;
    if (!secret) return true; // Если секрет не настроен, пропускаем проверку
    
    const hash = crypto
        .createHmac('sha256', secret)
        .update(JSON.stringify(data))
        .digest('hex');
    
    return hash === signature;
}

// Функция проверки подписи 0xProcessing
function verifyCryptoSignature(data, signature) {
    const secret = process.env.PROCESSING_SECRET_KEY;
    if (!secret) return true;
    
    const { PaymentId, MerchantId, Email, Currency } = data;
    const rawString = `${PaymentId}:${MerchantId}:${Email}:${Currency}:${secret}`;
    const hash = crypto.createHash('md5').update(rawString).digest('hex');
    
    return hash === signature;
}

/**
 * Обработчик Lava webhook для MeeMee
 */
export async function handleMeeMemeLavaWebhook(req, res) {
    try {
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📥 [MeeMee] Lava webhook received at:', new Date().toISOString());
        console.log('📦 Full webhook data:', JSON.stringify(req.body, null, 2));
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

        const eventType = req.body.eventType;
        const status = req.body.status;
        const email = req.body.buyer?.email;
        const contractId = req.body.contractId;

        console.log(`📊 [MeeMee] Extracted: eventType=${eventType}, status=${status}, email=${email}, contractId=${contractId}`);

        // Проверка подписи
        const signature = req.headers['x-signature'];
        if (signature) {
            const isValid = verifyLavaSignature(req.body, signature);
            console.log(`🔐 [MeeMee] Signature verification: ${isValid ? '✅ Valid' : '❌ Invalid'}`);
            if (!isValid) {
                console.error('❌ [MeeMee] Invalid Lava signature');
                return res.status(403).json({ error: 'Invalid signature' });
            }
        }

        if (!email) {
            console.error('❌ [MeeMee] No email in webhook data');
            return res.status(400).json({ error: 'Email required' });
        }

        // Находим заказ по email
        console.log(`🔍 [MeeMee] Searching for order with email: ${email}`);
        const order = await meeMeeOrderService.getOrderByEmail(email);
        if (!order) {
            console.error('❌ [MeeMee] Order not found for email:', email);
            return res.status(404).json({ error: 'Order not found' });
        }

        console.log(`📦 [MeeMee] Order found: orderId=${order.orderId}, userId=${order.userId}, package=${order.package}`);

        if (order.isPaid) {
            console.log('ℹ️ [MeeMee] Order already paid:', order.orderId);
            return res.status(200).json({ success: true, message: 'Already paid' });
        }

        // Обрабатываем успешный платеж
        const isSuccess = (eventType === 'payment' && status === 'success') || 
                         (eventType === 'payment' && status === 'completed');

        if (isSuccess) {
            console.log('✅ [MeeMee] Payment successful, processing...');

            // Обновляем заказ
            order.isPaid = true;
            order.paidAt = new Date();
            order.contractId = contractId;
            await meeMeeOrderService.updateOrder(order.orderId, order);

            // Добавляем генерации пользователю
            const user = await meeMeeUserService.getUserById(order.userId);
            if (user) {
                const generationsToAdd = order.generations || 1;
                user.paid_quota = (user.paid_quota || 0) + generationsToAdd;
                await meeMeeUserService.updateUser(order.userId, user);
                console.log(`✅ [MeeMee] Added ${generationsToAdd} generations to user ${order.userId}`);

                // Обрабатываем реферальную программу
                if (user.referredBy) {
                    try {
                        await meeMeeReferralService.processReferralPayment(
                            user.referredBy,
                            order.userId,
                            order.amount || 0
                        );
                        console.log(`✅ [MeeMee] Processed referral for user ${user.referredBy}`);
                    } catch (refError) {
                        console.error('❌ [MeeMee] Referral processing error:', refError);
                    }
                }

                // Отправляем уведомление пользователю
                try {
                    await meeMeeBot.telegram.sendMessage(
                        order.userId,
                        '✅ Оплата прошла успешно!\n\n' +
                        `На ваш баланс добавлено ${generationsToAdd} ${generationsToAdd === 1 ? 'видео' : 'видео'}.\n\n` +
                        'Хотите запустить генерацию сейчас?',
                        {
                            reply_markup: {
                                inline_keyboard: [
                                    [{ text: '🎬 Создать видео', callback_data: 'catalog' }],
                                    [{ text: '🔙 Главное меню', callback_data: 'main_menu' }]
                                ]
                            }
                        }
                    );
                    console.log(`✅ [MeeMee] Notification sent to user ${order.userId}`);
                } catch (notifyError) {
                    console.error('❌ [MeeMee] Failed to send notification:', notifyError);
                }
            }

            return res.status(200).json({ success: true });
        } else {
            console.log(`⚠️ [MeeMee] Payment not successful: eventType=${eventType}, status=${status}`);
            return res.status(200).json({ success: false, message: 'Payment not completed' });
        }

    } catch (error) {
        console.error('❌ [MeeMee] Error processing Lava webhook:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}

/**
 * Обработчик 0xProcessing webhook для MeeMee
 */
export async function handleMeeMemeCryptoWebhook(req, res) {
    try {
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📥 [MeeMee] Crypto webhook received at:', new Date().toISOString());
        console.log('📦 Full webhook data:', JSON.stringify(req.body, null, 2));
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

        const data = req.body;
        const receivedSignature = data.Signature;

        // Проверка подписи
        if (!verifyCryptoSignature(data, receivedSignature)) {
            console.error('❌ [MeeMee] Invalid crypto signature');
            return res.status(400).json({ error: 'Invalid signature' });
        }

        const { PaymentId, Status, BillingID, Email } = data;
        console.log(`📊 [MeeMee] Extracted: PaymentId=${PaymentId}, Status=${Status}, BillingID=${BillingID}, Email=${Email}`);

        // Находим заказ
        let order;
        if (BillingID) {
            order = await meeMeeOrderService.getOrderById(BillingID);
        } else if (Email) {
            order = await meeMeeOrderService.getOrderByEmail(Email);
        }

        if (!order) {
            console.error('❌ [MeeMee] Order not found');
            return res.status(404).json({ error: 'Order not found' });
        }

        console.log(`📦 [MeeMee] Order found: orderId=${order.orderId}, userId=${order.userId}`);

        if (order.isPaid) {
            console.log('ℹ️ [MeeMee] Order already paid:', order.orderId);
            return res.status(200).json({ success: true, message: 'Already paid' });
        }

        // Обрабатываем успешный платеж
        if (Status === 'Paid' || Status === 'paid') {
            console.log('✅ [MeeMee] Crypto payment successful, processing...');

            // Обновляем заказ
            order.isPaid = true;
            order.paidAt = new Date();
            order.paymentId = PaymentId;
            await meeMeeOrderService.updateOrder(order.orderId, order);

            // Добавляем генерации пользователю
            const user = await meeMeeUserService.getUserById(order.userId);
            if (user) {
                const generationsToAdd = order.generations || 1;
                user.paid_quota = (user.paid_quota || 0) + generationsToAdd;
                await meeMeeUserService.updateUser(order.userId, user);
                console.log(`✅ [MeeMee] Added ${generationsToAdd} generations to user ${order.userId}`);

                // Обрабатываем реферальную программу
                if (user.referredBy) {
                    try {
                        await meeMeeReferralService.processReferralPayment(
                            user.referredBy,
                            order.userId,
                            order.amount || 0
                        );
                        console.log(`✅ [MeeMee] Processed referral for user ${user.referredBy}`);
                    } catch (refError) {
                        console.error('❌ [MeeMee] Referral processing error:', refError);
                    }
                }

                // Отправляем уведомление пользователю
                try {
                    await meeMeeBot.telegram.sendMessage(
                        order.userId,
                        '✅ Оплата прошла успешно!\n\n' +
                        `На ваш баланс добавлено ${generationsToAdd} ${generationsToAdd === 1 ? 'видео' : 'видео'}.\n\n` +
                        'Хотите запустить генерацию сейчас?',
                        {
                            reply_markup: {
                                inline_keyboard: [
                                    [{ text: '🎬 Создать видео', callback_data: 'catalog' }],
                                    [{ text: '🔙 Главное меню', callback_data: 'main_menu' }]
                                ]
                            }
                        }
                    );
                    console.log(`✅ [MeeMee] Notification sent to user ${order.userId}`);
                } catch (notifyError) {
                    console.error('❌ [MeeMee] Failed to send notification:', notifyError);
                }
            }

            return res.status(200).json({ success: true });
        } else {
            console.log(`⚠️ [MeeMee] Payment not successful: Status=${Status}`);
            return res.status(200).json({ success: false, message: 'Payment not completed' });
        }

    } catch (error) {
        console.error('❌ [MeeMee] Error processing crypto webhook:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
