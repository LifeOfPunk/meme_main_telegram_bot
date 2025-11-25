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

            // Получаем Offer ID из конфига
            const packageConfig = PACKAGES[pkg];
            console.log(`📦 Package config:`, packageConfig);
            
            if (!packageConfig || !packageConfig.offerIdLava) {
                console.error('❌ Package config missing or no offerIdLava');
                console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
                return { error: 'Некорректный пакет или не настроен Lava Offer ID' };
            }

            const data = {
                email,
                offerId: packageConfig.offerIdLava,
                buyerLanguage: 'RU',
                currency: this.currency[bank],
            };

            const requestUrl = `${this.baseUrl}/api/v2/invoice`;
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log('📤 Preparing API request to Lava');
            console.log(`🌐 URL: ${requestUrl}`);
            console.log(`📦 Request data:`, JSON.stringify(data, null, 2));
            console.log(`🔑 X-Api-Key header: ${this.api?.substring(0, 20)}...`);
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

            const response = await axios.post(
                requestUrl,
                data,
                {
                    headers: {
                        'X-Api-Key': this.api
                    }
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

            const orderData = {
                orderId,
                userId,
                email,
                input: data,
                output: response.data,
                isPaid: false,
                isFiat: true,
                package: pkg,
                amount: amount,
                parentId: response.data.id,
                createdAt: new Date().toISOString()
            };

            console.log('💾 Saving order to database...');
            await orderService.createOrder(orderData);
            console.log(`✅ Order saved successfully: ${orderId}`);
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
            
            if (err.response) {
                console.error(`HTTP Status: ${err.response.status}`);
                console.error(`Response data:`, JSON.stringify(err.response.data, null, 2));
                console.error(`Response headers:`, JSON.stringify(err.response.headers, null, 2));
            }
            
            if (err.request) {
                console.error(`Request was made but no response received`);
                console.error(`Request URL: ${err.config?.url}`);
                console.error(`Request method: ${err.config?.method}`);
            }
            
            console.error('Full error stack:', err.stack);
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            
            return { error: err.toString() };
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