import 'dotenv/config';
import axios from 'axios';
import BigNumber from 'bignumber.js';
import { OrderService } from './Order.service.js';

export class PaymentCryptoService {
    constructor() {
        this.baseUrl = 'https://app.0xprocessing.com';
        this.api = process.env.PAYMENT_API;
        this.merchant = process.env.MERCHANT_ID || '0xMR8252827';
    }

    // Создание крипто-платежа
    async createPayment({ userId, amount, payCurrency, package: pkg }) {
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('🚀 [PaymentCrypto] Starting createPayment');
        console.log(`📊 Input: userId=${userId}, amount=${amount}, currency=${payCurrency}, package=${pkg}`);
        
        try {
            const orderService = new OrderService();
            
            // Проверка на существующий заказ
            const userOrders = await orderService.getOrdersByUserId(userId);
            const tenMinutesFromNow = new Date(Date.now() + 10 * 60 * 1000);

            const existingOrder = userOrders.find(order =>
                order?.input?.amount === amount &&
                new Date(order?.output?.expiredAt) < tenMinutesFromNow &&
                order?.input?.payCurrency === payCurrency
            );

            if (existingOrder) {
                console.log(`♻️ Reusing existing order: ${existingOrder.orderId}`);
                return existingOrder;
            }

            const orderId = orderService.generateOrderId('CRYPTO');
            console.log(`📝 Generated order ID: ${orderId}`);

            // Данные для 0xProcessing
            const data = {
                merchantID: this.merchant,
                billingID: orderId,
                currency: payCurrency,
                email: `user${userId}@meemee.bot`,
                clientId: userId.toString()
            };

            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log('📤 [CRYPTO] Sending request to 0xProcessing');
            console.log(`🌐 URL: ${this.baseUrl}/payment`);
            console.log(`📦 Data:`, data);
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

            const response = await axios.post(
                `${this.baseUrl}/payment`,
                new URLSearchParams(data).toString(),
                {
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded'
                    },
                    timeout: 30000
                }
            );

            console.log('✅ [CRYPTO] Response received');
            console.log(`📥 Status: ${response.status}`);
            console.log(`📥 Data:`, JSON.stringify(response.data, null, 2));

            // Расчёт суммы в криптовалюте
            const amountInCrypto = new BigNumber(amount)
                .div(payCurrency.includes('USDT') || payCurrency.includes('USDC') ? 1 : response.data.rate)
                .toFixed(5);

            data.amountUSD = amount;
            data.amount = amountInCrypto;
            data.package = pkg;
            data.payCurrency = payCurrency;
            data.createdAt = new Date().toISOString();

            // Проверка минимальной суммы
            try {
                const coinInfoResponse = await axios.get(
                    `${this.baseUrl}/Api/CoinInfo/${payCurrency}`
                );
                
                if (coinInfoResponse.data && coinInfoResponse.data.min) {
                    if (new BigNumber(data.amount).isLessThan(coinInfoResponse.data.min)) {
                        console.log(`❌ Amount ${data.amount} < minimum ${coinInfoResponse.data.min}`);
                        return { error: 'Сумма оплаты слишком мала для этой сети. Попробуйте другую.' };
                    }
                }
            } catch (minCheckError) {
                console.warn(`⚠️ Could not check minimum amount, skipping:`, minCheckError.message);
            }

            // Сохраняем заказ
            const orderData = {
                orderId,
                userId,
                input: data,
                output: response.data,
                isPaid: false,
                isFiat: false,
                package: pkg,
                amount: amount,
                currency: payCurrency
            };

            console.log('💾 Saving order to database...');
            await orderService.createOrder(orderData);
            console.log(`✅ Order saved: ${orderId}`);
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

            return orderData;
        } catch (err) {
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.error('❌❌❌ ERROR in createPayment ❌❌❌');
            console.error(`Error message: ${err.message}`);
            console.error(`Error name: ${err.name}`);
            
            if (err.response) {
                console.error(`HTTP Status: ${err.response.status}`);
                console.error(`Response data:`, err.response.data);
            }
            
            console.error('Full error stack:', err.stack);
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            
            return { error: err.message };
        }
    }

    // Проверка статуса платежа через API 0xProcessing
    async checkPaymentStatus(orderId) {
        try {
            console.log(`🔍 [PaymentCrypto] Checking status for order: ${orderId}`);
            
            const orderService = new OrderService();
            const order = await orderService.getOrderById(orderId);
            
            if (!order) {
                console.log(`❌ Order not found: ${orderId}`);
                return { error: 'Заказ не найден' };
            }
            
            if (order.isPaid) {
                console.log(`✅ Order already marked as paid: ${orderId}`);
                return { status: 'paid' };
            }

            // Проверяем через API 0xProcessing
            try {
                console.log(`📡 Calling 0xProcessing API to check status...`);
                const response = await axios.get(
                    `${this.baseUrl}/Api/PaymentStatus/${orderId}`,
                    {
                        headers: {
                            'Authorization': `Bearer ${this.api}`
                        },
                        timeout: 10000
                    }
                );

                console.log(`📥 API Response:`, response.data);

                // Проверяем статус из ответа
                const status = response.data?.status || response.data?.Status;
                
                if (status && (
                    status.toLowerCase() === 'success' || 
                    status.toLowerCase() === 'paid' || 
                    status.toLowerCase() === 'completed'
                )) {
                    console.log(`✅ Payment confirmed by API: ${orderId}`);
                    return { status: 'paid' };
                }

                console.log(`⏳ Payment still pending: ${orderId}`);
                return { status: 'pending' };

            } catch (apiErr) {
                console.error(`⚠️ API check failed:`, apiErr.message);
                // Если API недоступен, возвращаем pending
                return { status: 'pending' };
            }

        } catch (err) {
            console.error('❌ Error checking payment status:', err);
            return { error: err.message };
        }
    }
}
