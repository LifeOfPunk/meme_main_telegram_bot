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
    async createPayment({ userId, amount = 0.50, payCurrency, package: pkg = 'deposit' }) {
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('🚀 [PaymentCrypto] Starting createPayment');
        console.log(`📊 Input: userId=${userId}, amount=${amount}, currency=${payCurrency}, package=${pkg}`);
        
        try {
            // Валидация лимитов депозита: 0.50 - 10000.00 USDT
            const numAmount = Number(amount || 0.50);
            if (numAmount < 0.50 || numAmount > 10000.00) {
                return { error: 'Сумма депозита должна быть от 0.50 до 10 000.00 USDT' };
            }

            const orderService = new OrderService();
            
            // Проверка на существующий заказ
            let existingOrder = null;
            try {
                const userOrders = await orderService.getOrdersByUserId(userId);
                const tenMinutesFromNow = new Date(Date.now() + 10 * 60 * 1000);

                existingOrder = userOrders.find(order =>
                    order?.input?.amountUSD === numAmount &&
                    new Date(order?.output?.expDate || order?.output?.expiredAt) > new Date() &&
                    order?.input?.payCurrency === payCurrency
                );
            } catch (orderCheckErr) {
                console.warn('⚠️ Could not check existing orders:', orderCheckErr.message);
            }

            if (existingOrder) {
                console.log(`♻️ Reusing existing order: ${existingOrder.orderId}`);
                return existingOrder;
            }

            const orderId = orderService.generateOrderId('CRYPTO');
            console.log(`📝 Generated order ID: ${orderId}`);

            // Нормализация валюты для 0xProcessing (BNB в 0xProcessing называется 'BNB', а не 'BNB (BEP20)')
            const currencyForProcessing = payCurrency === 'BNB (BEP20)' ? 'BNB' : payCurrency;

            // Данные для 0xProcessing (БЕЗ amount - он рассчитается на их стороне)
            const data = {
                merchantID: this.merchant,
                billingID: orderId,
                currency: currencyForProcessing,
                email: `user${userId}@viralapp.bot`,
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
            console.log(`📥 Data:`, typeof response.data === 'string' ? `(string, length ${response.data.length})` : JSON.stringify(response.data, null, 2));

            // Проверяем, вернулся ли HTML (redirect) или JSON
            let responseData = response.data;
            
            // Если получили JSON напрямую (новый формат API)
            if (typeof responseData === 'object' && responseData !== null && (responseData.id || responseData.uid)) {
                console.log('📦 Received JSON response (direct API format)');
                console.log('📥 Data:', JSON.stringify(responseData, null, 2));
                
                // Преобразуем в нужный формат (без искусственного формирования 404 URL)
                const uid = (responseData.id || responseData.uid).toString();
                responseData = {
                    uid: uid,
                    id: uid,
                    paymentUrl: responseData.paymentUrl || responseData.url || null,
                    address: responseData.address,
                    qrCode: responseData.qrCode,
                    rate: responseData.rate ? parseFloat(responseData.rate) : null,
                    minimumAmount: responseData.minimumAmount ? parseFloat(responseData.minimumAmount) : 0.50,
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
                    
                    // Собираем данные из HTML (без фиктивных 404 URL)
                    responseData = {
                        uid: uid,
                        id: uid,
                        paymentUrl: null,
                        expDate: expDateMatch ? expDateMatch[1] : new Date(Date.now() + 30 * 60 * 1000).toISOString()
                    };
                    
                    // Добавляем адрес если найден
                    if (addressMatch && addressMatch[1]) {
                        responseData.address = addressMatch[1];
                        console.log(`✅ Extracted address: ${addressMatch[1]}`);
                    }
                    
                    // Добавляем QR-код если найден
                    if (qrCodeMatch && qrCodeMatch[1]) {
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
                } else {
                    console.error('❌ Could not extract UID from HTML response');
                    return { error: 'Не удалось создать платеж. Попробуйте другую сеть.' };
                }
            } else {
                console.log('📦 Received JSON response (old 0xProcessing format)');
            }

            // Расчёт суммы в криптовалюте ПОСЛЕ извлечения курса
            let amountInCrypto;
            const isUsdPegged = payCurrency.includes('USDT') || payCurrency.includes('USDC');
            if (isUsdPegged) {
                amountInCrypto = new BigNumber(numAmount).toFixed(2);
            } else {
                const effectiveRate = responseData?.rate;
                if (effectiveRate && !isNaN(effectiveRate) && Number(effectiveRate) > 0) {
                    amountInCrypto = new BigNumber(numAmount).div(effectiveRate).toFixed(5);
                } else {
                    console.warn(`⚠️ Rate not available for ${payCurrency}, using default amount`);
                    amountInCrypto = new BigNumber(numAmount).toFixed(5);
                }
            }

            data.amountUSD = numAmount;
            data.amount = amountInCrypto;
            data.package = pkg;
            data.payCurrency = payCurrency;
            data.createdAt = new Date().toISOString();
            
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
                amount: numAmount,
                cryptoAmount: amountInCrypto,
                currency: payCurrency
            };

            console.log('💾 Saving order to database...');
            try {
                await orderService.createOrder(orderData);
                console.log(`✅ Order saved: ${orderId}`);
            } catch (redisErr) {
                console.warn('⚠️ Could not save order to Redis (offline mode):', redisErr.message);
            }
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

    // Проверка статуса платежа через блокчейн (on-chain) и fallback на API 0xProcessing
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
                return { status: 'paid', amount: Number(order.amount || 2.0) };
            }

            const address = order.output?.address || order.output?.Address || order.output?.wallet;
            const currency = (order.currency || order.input?.payCurrency || order.input?.currency || '').toUpperCase();
            console.log(`📡 Checking order ${orderId}: address=${address}, currency=${currency}`);

            // 1. Проверка on-chain в BSC (BEP-20 / BNB)
            if (address && address.startsWith('0x')) {
                // А. Проверка USDT (BEP-20)
                try {
                    const cleanAddress = address.toLowerCase().replace('0x', '').padStart(64, '0');
                    const rpcResponse = await axios.post('https://bsc-dataseed1.binance.org/', {
                        jsonrpc: '2.0',
                        method: 'eth_call',
                        params: [{
                            to: '0x55d398326f99059ff775485246999027b3197955', // USDT BSC Contract
                            data: `0x70a08231${cleanAddress}`
                        }, 'latest'],
                        id: 1
                    }, { timeout: 7000 });

                    if (rpcResponse.data?.result && rpcResponse.data.result !== '0x') {
                        const hexVal = rpcResponse.data.result;
                        const rawBalance = new BigNumber(hexVal, 16);
                        const usdtBalance = rawBalance.dividedBy(new BigNumber(10).pow(18)).toNumber();
                        console.log(`🔗 BSC on-chain USDT balance for ${address}: ${usdtBalance} USDT`);

                        if (usdtBalance >= 0.5) {
                            console.log(`✅ On-chain USDT payment confirmed! Balance: ${usdtBalance} USDT`);
                            return { status: 'paid', amount: usdtBalance };
                        }
                    }
                } catch (bscErr) {
                    console.warn(`⚠️ BSC USDT check error:`, bscErr.message);
                }

                // Б. Проверка нативного BNB
                if (currency.includes('BNB')) {
                    try {
                        const bnbResponse = await axios.post('https://bsc-dataseed1.binance.org/', {
                            jsonrpc: '2.0',
                            method: 'eth_getBalance',
                            params: [address, 'latest'],
                            id: 2
                        }, { timeout: 7000 });

                        if (bnbResponse.data?.result) {
                            const rawBnb = new BigNumber(bnbResponse.data.result, 16);
                            const bnbBalance = rawBnb.dividedBy(new BigNumber(10).pow(18)).toNumber();
                            console.log(`🔗 BSC on-chain BNB balance for ${address}: ${bnbBalance} BNB`);

                            if (bnbBalance >= 0.003) {
                                console.log(`✅ On-chain BNB payment confirmed! Balance: ${bnbBalance} BNB`);
                                return { status: 'paid', amount: Number(order.amount || 4.0) };
                            }
                        }
                    } catch (bnbErr) {
                        console.warn(`⚠️ BSC BNB check error:`, bnbErr.message);
                    }
                }
            }

            // 2. Проверка on-chain в Tron (TRC-20 USDT)
            if (address && address.startsWith('T')) {
                try {
                    const tronResp = await axios.get(`https://apilist.tronscanapi.com/api/account?address=${address}`, { timeout: 7000 });
                    if (tronResp.data?.trc20token_balances) {
                        const usdtToken = tronResp.data.trc20token_balances.find(t => t.tokenId === 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t');
                        if (usdtToken) {
                            const tronBalance = Number(usdtToken.balance) / 1e6;
                            console.log(`🔗 TRON on-chain USDT balance for ${address}: ${tronBalance} USDT`);
                            if (tronBalance >= 0.5) {
                                console.log(`✅ On-chain TRC20 USDT payment confirmed! Balance: ${tronBalance} USDT`);
                                return { status: 'paid', amount: tronBalance };
                            }
                        }
                    }
                } catch (tronErr) {
                    console.warn(`⚠️ Tron on-chain check error:`, tronErr.message);
                }
            }

            // 3. Fallback: Проверка через API 0xProcessing
            try {
                const paymentUid = order.output?.uid || order.output?.id || orderId;
                const response = await axios.get(
                    `${this.baseUrl}/Api/PaymentStatus/${paymentUid}`,
                    {
                        headers: {
                            'Authorization': `Bearer ${this.api}`
                        },
                        timeout: 5000
                    }
                );

                const status = response.data?.status || response.data?.Status;
                if (status && (
                    status.toLowerCase() === 'success' || 
                    status.toLowerCase() === 'paid' || 
                    status.toLowerCase() === 'completed'
                )) {
                    console.log(`✅ Payment confirmed by API: ${orderId}`);
                    return { status: 'paid', amount: Number(response.data?.AmountUSD || order.amount || 2.0) };
                }
            } catch (apiErr) {
                // API 404 is normal if endpoint is deprecated; on-chain check was already performed
            }

            console.log(`⏳ Payment still pending: ${orderId}`);
            return { status: 'pending' };

        } catch (err) {
            console.error('❌ Error checking payment status:', err);
            return { error: err.message };
        }
    }
}
