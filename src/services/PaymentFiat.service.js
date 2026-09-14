import 'dotenv/config';
import axios from 'axios';
import { OrderService } from './Order.service.js';
import { PACKAGES } from '../config.js';

export class PaymentFiatService {
    constructor() {
        this.baseUrl = 'https://gate.lava.top';
        this.api = process.env.LAVA_PAYMENT_API;
        this.currency = {
            'BANK131': 'RUB',
            'UNLIMINT': 'USD'
        };
    }

    // Создание фиат-платежа
    async createPayment({ userId, email, amount, bank = 'BANK131', package: pkg }) {
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('🚀 [PaymentFiat] Starting createPayment');
        console.log(`📊 Input params: userId=${userId}, email=${email}, amount=${amount}, bank=${bank}, package=${pkg}`);
        console.log(`🔧 Config: baseUrl=${this.baseUrl}`);
        console.log(`🔑 API Key exists: ${!!this.api}, length: ${this.api?.length || 0}`);
        
        try {
            const orderService = new OrderService();
            const orderId = orderService.generateOrderId('FIAT');
            console.log(`📝 Generated order ID: ${orderId}`);

            const apiKey = (this.api || '').trim();
            if (!apiKey) {
                console.error('❌ LAVA_PAYMENT_API is missing or empty');
                return { error: 'Платежный шлюз Lava не настроен (отсутствует API ключ)' };
            }

            // Получаем Offer ID из конфига
            const packageConfig = PACKAGES[pkg];
            console.log(`📦 Package config:`, packageConfig);
            
            if (!packageConfig || !packageConfig.offerIdLava) {
                console.error('❌ Package config missing or no offerIdLava');
                console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
                return { error: 'Некорректный пакет или не настроен Lava Offer ID' };
            }

            // Нормализация и валидация email
            let finalEmail = (email || '').toString().trim().toLowerCase();
            const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
            if (!emailRegex.test(finalEmail)) {
                if (userId) {
                    finalEmail = `user${userId}@viralapp.bot`;
                    console.log(`⚠️ Invalid or empty email provided, fallback to auto-generated: ${finalEmail}`);
                } else {
                    return { error: 'Неверный формат email адреса' };
                }
            }

            // Валидация суммы
            const finalAmount = Number(amount || packageConfig.rub);
            if (!finalAmount || isNaN(finalAmount) || finalAmount <= 0) {
                console.error(`❌ Invalid amount: ${amount} (rub: ${packageConfig.rub})`);
                return { error: 'Некорректная сумма платежа' };
            }

            const currencyCode = this.currency[bank] || 'RUB';
            const offerId = packageConfig.offerIdLava.trim();

            const data = {
                email: finalEmail,
                offerId: offerId,
                buyerLanguage: 'RU',
                currency: currencyCode,
            };

            const requestUrl = `${this.baseUrl}/api/v2/invoice`;
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log('📤 Preparing API request to Lava');
            console.log(`🌐 URL: ${requestUrl}`);
            console.log(`📦 Request data:`, JSON.stringify(data, null, 2));
            console.log(`🔑 X-Api-Key header: ${apiKey.substring(0, 10)}... (len: ${apiKey.length})`);
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

            const response = await axios.post(
                requestUrl,
                data,
                {
                    headers: {
                        'X-Api-Key': apiKey,
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    timeout: 30000
                }
            );

            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log('✅ API request successful!');
            console.log(`📥 Response status: ${response.status}`);
            console.log(`📥 Response data:`, JSON.stringify(response.data, null, 2));
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

            if (response.data.error) {
                console.error(`❌ Lava error: ${response.data.error}`);
                return { error: response.data.error };
            }

            const paymentUrl = response.data?.url || response.data?.paymentUrl || response.data?.payUrl || (response.data?.id ? `https://lava.top/invoice/${response.data.id}` : null);
            const normalizedOutput = {
                ...response.data,
                paymentUrl
            };

            const orderData = {
                orderId,
                userId,
                email: finalEmail,
                input: data,
                output: normalizedOutput,
                isPaid: false,
                isFiat: true,
                package: pkg,
                amount: finalAmount,
                parentId: response.data?.id,
                createdAt: new Date().toISOString()
            };

            console.log('💾 Saving order to database...');
            try {
                await orderService.createOrder(orderData);
                console.log(`✅ Order saved successfully: ${orderId}`);
            } catch (redisErr) {
                console.warn('⚠️ Could not save order to Redis (offline mode):', redisErr.message);
            }
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log(`💵 Fiat payment created successfully: ${orderId}`);
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            return orderData;
        } catch (err) {
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.error('❌❌❌ ERROR in createPayment (Fiat) ❌❌❌');
            console.error(`Error message: ${err.message}`);
            console.error(`Error name: ${err.name}`);
            console.error(`Error code: ${err.code}`);
            
            let detailedErrorMessage = null;
            if (err.response) {
                console.error(`HTTP Status: ${err.response.status}`);
                console.error(`Response data:`, JSON.stringify(err.response.data, null, 2));
                console.error(`Response headers:`, JSON.stringify(err.response.headers, null, 2));

                const respData = err.response.data;
                if (typeof respData === 'string') {
                    detailedErrorMessage = respData;
                } else if (respData?.message) {
                    detailedErrorMessage = Array.isArray(respData.message)
                        ? respData.message.join(', ')
                        : respData.message;
                } else if (respData?.error) {
                    detailedErrorMessage = typeof respData.error === 'object'
                        ? JSON.stringify(respData.error)
                        : respData.error;
                } else if (respData?.errors) {
                    detailedErrorMessage = Array.isArray(respData.errors)
                        ? respData.errors.map(e => e.msg || e.message || JSON.stringify(e)).join(', ')
                        : JSON.stringify(respData.errors);
                }
            }
            
            if (err.request) {
                console.error(`Request was made but no response received`);
                console.error(`Request URL: ${err.config?.url}`);
                console.error(`Request method: ${err.config?.method}`);
            }
            
            console.error('Full error stack:', err.stack);
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            
            const errorMsg = detailedErrorMessage || err.message || 'Ошибка платежного шлюза Lava';
            return { error: errorMsg, status: err.response?.status };
        }
    }

    // Сохранение связи Lava ID с нашим Order ID
    async saveLavaMapping(lavaOrderId, orderId) {
        const redis = (await import('../redis.js')).default;
        await redis.set(`lava_id:${lavaOrderId}`, orderId);
    }

    // Получение Order ID по Lava ID
    async getOrderIdByLavaId(lavaOrderId) {
        const redis = (await import('../redis.js')).default;
        return await redis.get(`lava_id:${lavaOrderId}`);
    }
}