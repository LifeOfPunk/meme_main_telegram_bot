import redis from '../redis.js';

export class OrderService {
    // Создание заказа
    async createOrder(orderData) {
        const { orderId, userId } = orderData;

        await redis.set(`order:${orderId}`, JSON.stringify(orderData));
        await redis.lpush('all_orders', orderId);
        await redis.lpush(`user_orders:${userId}`, orderId);

        if (orderData.email || orderData.input?.email) {
            const email = orderData.email || orderData.input?.email;
            await redis.set(`email_to_order:${email}`, orderId);
        }

        if (orderData.parentId) {
            await redis.set(`parent_to_order:${orderData.parentId}`, orderId);
        }

        const outputUid = orderData.output?.id || orderData.output?.uid;
        if (outputUid) {
            await redis.set(`parent_to_order:${outputUid}`, orderId);
        }

        const outputAddress = orderData.output?.address || orderData.output?.Address || orderData.output?.wallet;
        if (outputAddress) {
            await redis.set(`address_to_order:${outputAddress.toLowerCase()}`, orderId);
            await redis.set(`parent_to_order:${outputAddress}`, orderId);
        }

        console.log(`📝 Order ${orderId} created for user ${userId}`);
        return orderData;
    }

    // Получение заказа по ID
    async getOrderById(orderId) {
        if (!orderId) return null;
        const order = await redis.get(`order:${orderId}`);
        return order ? JSON.parse(order) : null;
    }

    // Получение заказа по внешнему ID (Lava invoiceId, 0xProcessing UID)
    async getOrderByParentId(parentId) {
        if (!parentId) return null;
        const orderId = await redis.get(`parent_to_order:${parentId}`);
        return orderId ? await this.getOrderById(orderId) : null;
    }

    // Получение заказа по адресу кошелька
    async getOrderByAddress(address) {
        if (!address) return null;
        const orderId = await redis.get(`address_to_order:${address.toLowerCase()}`);
        return orderId ? await this.getOrderById(orderId) : null;
    }

    // Получение заказа по email
    async getOrderByEmail(email) {
        if (!email) return null;
        const orderId = await redis.get(`email_to_order:${email}`);
        return orderId ? await this.getOrderById(orderId) : null;
    }

    // Обновление заказа
    async updateOrder(orderId, data) {
        const order = await this.getOrderById(orderId);
        if (!order) return null;

        const updatedOrder = {
            ...order,
            ...data,
            updatedAt: new Date().toISOString()
        };

        await redis.set(`order:${orderId}`, JSON.stringify(updatedOrder));
        console.log(`✅ Order ${orderId} updated`);
        return updatedOrder;
    }

    // Получение заказов пользователя
    async getUserOrders(userId) {
        const orderIds = await redis.lrange(`user_orders:${userId}`, 0, -1);
        const orders = [];

        for (const orderId of orderIds) {
            const order = await this.getOrderById(orderId);
            if (order) orders.push(order);
        }

        return orders;
    }

    // Алиас для совместимости
    async getOrdersByUserId(userId) {
        return await this.getUserOrders(userId);
    }

    // Получение всех заказов
    async getAllOrders() {
        const orderIds = await redis.lrange('all_orders', 0, -1);
        const orders = [];

        for (const orderId of orderIds) {
            const order = await this.getOrderById(orderId);
            if (order) orders.push(order);
        }

        return orders;
    }

    // Отметка заказа как оплаченного
    async markAsPaid(orderId, extraData = {}) {
        return await this.updateOrder(orderId, { 
            isPaid: true, 
            paidAt: new Date().toISOString(),
            ...extraData
        });
    }

    // Получение заказа по email
    async getOrderByEmail(email) {
        const orderId = await redis.get(`email_to_order:${email}`);
        return orderId ? await this.getOrderById(orderId) : null;
    }

    // Получение статистики платежей
    async getPaymentStats() {
        const orders = await this.getAllOrders();
        
        const paidOrders = orders.filter(o => o.isPaid);
        const cryptoOrders = paidOrders.filter(o => !o.isFiat);
        const fiatOrders = paidOrders.filter(o => o.isFiat);
        
        // Разделяем крипто платежи по валютам (используем currency или crypto)
        const usdtOrders = cryptoOrders.filter(o => (o.crypto || o.currency || '').includes('USDT'));
        const usdcOrders = cryptoOrders.filter(o => (o.crypto || o.currency || '').includes('USDC'));
        const tonOrders = cryptoOrders.filter(o => (o.crypto || o.currency || '').includes('TON'));
        const bnbOrders = cryptoOrders.filter(o => (o.crypto || o.currency || '').includes('BNB'));
        
        const stats = {
            total: orders.length,
            paid: paidOrders.length,
            unpaid: orders.filter(o => !o.isPaid).length,
            crypto: cryptoOrders.length,
            fiat: fiatOrders.length,
            totalRevenue: paidOrders.reduce((sum, o) => sum + (o.amount || 0), 0),
            // Детальная статистика по валютам
            cryptoRevenue: {
                usdt: usdtOrders.reduce((sum, o) => sum + (Number(o.cryptoAmount) || Number(o.input?.amount) || 0), 0),
                usdc: usdcOrders.reduce((sum, o) => sum + (Number(o.cryptoAmount) || Number(o.input?.amount) || 0), 0),
                ton: tonOrders.reduce((sum, o) => sum + (Number(o.cryptoAmount) || Number(o.input?.amount) || 0), 0),
                bnb: bnbOrders.reduce((sum, o) => sum + (Number(o.cryptoAmount) || Number(o.input?.amount) || 0), 0),
                count: {
                    usdt: usdtOrders.length,
                    usdc: usdcOrders.length,
                    ton: tonOrders.length,
                    bnb: bnbOrders.length
                }
            },
            fiatRevenue: fiatOrders.reduce((sum, o) => sum + (o.amount || 0), 0)
        };

        return stats;
    }

    // Генерация ID заказа
    generateOrderId(type = 'ORDER') {
        const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const randomPart = Math.floor(1000000000 + Math.random() * 9000000000);
        return `${type}-${datePart}-${randomPart}`;
    }
}