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

            // Данные для 0xProcessing (БЕЗ amount - он рассчитается на их стороне)
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
            
            // Расчёт суммы в криптовалюте ПОСЛЕ получения ответа
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

            // Проверяем, вернулся ли HTML (redirect) или JSON
            let responseData = response.data;
            
            // Если получили JSON напрямую (новый формат API)
            if (typeof responseData === 'object' && responseData.id) {
                console.log('📦 Received JSON response (direct API format)');
                console.log('📥 Data:', JSON.stringify(responseData, null, 2));
                
                // Преобразуем в нужный формат
                const uid = responseData.id.toString();
                responseData = {
                    uid: uid,
                    id: uid,
                    paymentUrl: `https://app.0xprocessing.com/payment/${uid}`,
                    address: responseData.address,
                    qrCode: responseData.qrCode,
                    rate: responseData.rate,
                    minimumAmount: responseData.minimumAmount,
                    destinationTag: responseData.destinationTag,
                    expDate: responseData.expDate
                };
                
                console.log('✅ Converted to standard format');
                console.log('📦 Has address:', !!responseData.address);
                console.log('📦 Has QR code:', !!responseData.qrCode);
                
            } else if (typeof responseData === 'string' && responseData.includes('<!DOCTYPE html>')) {
                console.log('📄 Received HTML response (new 0xProcessing format)');
                console.log(`📏 HTML length: ${responseData.length} characters`);
                
                // Всегда показываем превью HTML для отладки
                console.log('🔍 HTML preview (first 800 chars):', responseData.substring(0, 800));
                
                // Проверяем на ошибку 404
                if (responseData.includes('404') || responseData.includes('Not Found') || responseData.includes('Page not found')) {
                    console.error('❌ 0xProcessing returned 404 page');
                    return { error: 'Ошибка создания платежа. Проверьте настройки Merchant ID или активируйте валюту в 0xProcessing.' };
                }
                
                // Извлекаем данные из HTML
                const uidMatch = responseData.match(/"uid":"([^"]+)"/);
                const addressMatch = responseData.match(/"address":"([^"]+)"/);
                const qrCodeMatch = responseData.match(/"qrCode":"(data:image[^"]+)"/);
                const rateMatch = responseData.match(/"rate":([0-9.]+)/);
                const minAmountMatch = responseData.match(/"minimumAmount":([0-9.]+)/);
                const expDateMatch = responseData.match(/"expDate":"([^"]+)"/);
                
                console.log('🔍 Regex matches:', {
                    uid: !!uidMatch,
                    address: !!addressMatch,
                    qrCode: !!qrCodeMatch,
                    rate: !!rateMatch,
                    minAmount: !!minAmountMatch,
                    expDate: !!expDateMatch
                });
                
                if (uidMatch && uidMatch[1]) {
                    const uid = uidMatch[1];
                    console.log(`✅ Extracted UID: ${uid}`);
                    
                    // Собираем данные из HTML
                    responseData = {
                        uid: uid,
                        id: uid,
                        paymentUrl: `https://app.0xprocessing.com/payment/${uid}`,
                        expDate: expDateMatch ? expDateMatch[1] : new Date(Date.now() + 30 * 60 * 1000).toISOString()
                    };
                    
                    // Добавляем адрес если найден
                    if (addressMatch && addressMatch[1]) {
                        responseData.address = addressMatch[1];
                        console.log(`✅ Extracted address: ${addressMatch[1]}`);
                    }
                    
                    // Добавляем QR-код если найден
                    if (qrCodeMatch && qrCodeMatch[1]) {
                        // QR-код может быть экранирован, убираем лишние слэши
                        responseData.qrCode = qrCodeMatch[1].replace(/\\"/g, '"').replace(/\\\//g, '/');
                        console.log(`✅ Extracted QR code (length: ${responseData.qrCode.length})`);
                    }
                    
                    // Добавляем курс если найден
                    if (rateMatch && rateMatch[1]) {
                        responseData.rate = parseFloat(rateMatch[1]);
                        console.log(`✅ Extracted rate: ${responseData.rate}`);
                    }
                    
                    // Добавляем минимальную сумму если найдена
                    if (minAmountMatch && minAmountMatch[1]) {
                        responseData.minimumAmount = parseFloat(minAmountMatch[1]);
                        console.log(`✅ Extracted minimum amount: ${responseData.minimumAmount}`);
                    }
                    
                    console.log('📦 Extracted data from HTML:', {
                        hasAddress: !!responseData.address,
                        hasQR: !!responseData.qrCode,
                        hasRate: !!responseData.rate,
                        hasMinAmount: !!responseData.minimumAmount
                    });
                    
                    // Если адрес не найден в HTML (старый формат)
                    if (!responseData.address) {
                        console.log('ℹ️ Payment address will be available on payment page');
                        console.log(`🔗 Payment URL: ${responseData.paymentUrl}`);
                    }
                } else {
                    console.error('❌ Could not extract UID from HTML response');
                    return { error: 'Не удалось создать платеж. Попробуйте другую сеть.' };
                }
            } else {
                console.log('📦 Received JSON response (old 0xProcessing format)');
            }
            
            console.log(`📥 Final Data:`, JSON.stringify(responseData, null, 2));

            // Сохраняем заказ
            const orderData = {
                orderId,
                userId,
                input: data,
                output: responseData,  // Используем обработанные данные вместо response.data
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
                // Используем uid от 0xProcessing, а не наш orderId
                const paymentUid = order.output?.uid || order.output?.id || orderId;
                console.log(`📡 Calling 0xProcessing API to check status...`);
                console.log(`   Using payment UID: ${paymentUid}`);
                
                const response = await axios.get(
                    `${this.baseUrl}/Api/PaymentStatus/${paymentUid}`,
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
