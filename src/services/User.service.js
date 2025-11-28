import redis from '../redis.js';
import { FREE_QUOTA_PER_USER } from '../config.js';

export class UserService {
    // Создание нового пользователя
    async createUser(telegramUser, refSource = null, utmSource = null) {
        const { id: userId, username, first_name: firstName, last_name: lastName } = telegramUser;

        const existingUser = await redis.get(`user:${userId}`);

        if (!existingUser) {
            const newUser = {
                userId,
                username: username || null,
                firstName: firstName || null,
                lastName: lastName || null,
                free_quota: FREE_QUOTA_PER_USER,
                paid_quota: 0,
                used_free_quota: 0,
                used_paid_quota: 0,
                total_generations: 0,
                successful_generations: 0,
                failed_generations: 0,
                total_spent: 0,
                remaining_balance: 0,
                referralSource: refSource || null,
                source: utmSource || null,
                referredUsers: [],
                expertReferrals: [],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            await redis.set(`user:${userId}`, JSON.stringify(newUser));
            await redis.sadd('all_users', userId);

            console.log(`✅ User ${userId} created with ${FREE_QUOTA_PER_USER} free generations`);

            return newUser;
        }

        return JSON.parse(existingUser);
    }

    // Получение пользователя
    async getUser(userId) {
        const user = await redis.get(`user:${userId}`);
        return user ? JSON.parse(user) : null;
    }

    // Обновление пользователя
    async updateUser(userId, data) {
        const user = await this.getUser(userId);
        if (!user) return null;

        const updatedUser = {
            ...user,
            ...data,
            updatedAt: new Date().toISOString()
        };

        await redis.set(`user:${userId}`, JSON.stringify(updatedUser));
        return updatedUser;
    }

    // Проверка наличия квот
    async hasQuota(userId) {
        const user = await this.getUser(userId);
        if (!user) return false;
        return user.free_quota > 0 || user.paid_quota > 0;
    }

    // Списание квоты
    async deductQuota(userId) {
        const user = await this.getUser(userId);
        if (!user) return false;

        if (user.free_quota > 0) {
            user.free_quota -= 1;
            user.used_free_quota = (user.used_free_quota || 0) + 1;
            await this.updateUser(userId, { 
                free_quota: user.free_quota,
                used_free_quota: user.used_free_quota
            });
            console.log(`⚖️ User ${userId}: deducted 1 free quota. Remaining: ${user.free_quota}`);
            return true;
        } else if (user.paid_quota > 0) {
            user.paid_quota -= 1;
            user.used_paid_quota = (user.used_paid_quota || 0) + 1;
            await this.updateUser(userId, { 
                paid_quota: user.paid_quota,
                used_paid_quota: user.used_paid_quota
            });
            console.log(`⚖️ User ${userId}: deducted 1 paid quota. Remaining: ${user.paid_quota}`);
            return true;
        }

        return false;
    }

    // Возврат квоты при ошибке
    async refundQuota(userId, isPaid = false) {
        const user = await this.getUser(userId);
        if (!user) return false;

        if (isPaid) {
            user.paid_quota += 1;
            await this.updateUser(userId, { paid_quota: user.paid_quota });
        } else {
            user.free_quota += 1;
            await this.updateUser(userId, { free_quota: user.free_quota });
        }

        console.log(`↩️ User ${userId}: refunded 1 quota`);
        return true;
    }

    // Добавление платных генераций
    async addPaidQuota(userId, amount) {
        const user = await this.getUser(userId);
        if (!user) return false;

        const newPaidQuota = user.paid_quota + amount;
        await this.updateUser(userId, { paid_quota: newPaidQuota });
        console.log(`💳 User ${userId}: added ${amount} paid generations. Total: ${newPaidQuota}`);
        return true;
    }

    // Добавление бесплатных генераций (реферальные бонусы)
    async addFreeQuota(userId, amount) {
        const user = await this.getUser(userId);
        if (!user) return false;

        const newFreeQuota = user.free_quota + amount;
        await this.updateUser(userId, { free_quota: newFreeQuota });
        console.log(`🎁 User ${userId}: added ${amount} free generations. Total: ${newFreeQuota}`);
        return true;
    }

    // Уменьшение бесплатных генераций (админ)
    async removeFreeQuota(userId, amount) {
        const user = await this.getUser(userId);
        if (!user) return false;

        const newFreeQuota = Math.max(0, user.free_quota - amount);
        await this.updateUser(userId, { free_quota: newFreeQuota });
        console.log(`➖ User ${userId}: removed ${amount} free generations. Total: ${newFreeQuota}`);
        return true;
    }

    // Установка точного количества бесплатных генераций (админ)
    async setFreeQuota(userId, amount) {
        const user = await this.getUser(userId);
        if (!user) return false;

        await this.updateUser(userId, { free_quota: amount });
        console.log(`⚙️ User ${userId}: set free quota to ${amount}`);
        return true;
    }

    // Получение всех пользователей
    async getAllUsers() {
        const userIds = await redis.smembers('all_users');
        const users = [];

        for (const userId of userIds) {
            // Преобразуем userId в число, если это строка
            const numericUserId = typeof userId === 'string' ? parseInt(userId) : userId;
            const user = await this.getUser(numericUserId);
            if (user) users.push(user);
        }

        console.log(`📊 getAllUsers: found ${users.length} users from ${userIds.length} user IDs`);
        return users;
    }

    // Получение общего количества пользователей
    async getTotalUsers() {
        return await redis.scard('all_users');
    }

    // Добавление email
    async addEmail(userId, email) {
        await redis.set(`user_email:${email}`, userId);
        await this.updateUser(userId, { email });
    }

    // Получение userId по email
    async getUserByEmail(email) {
        const userId = await redis.get(`user_email:${email}`);
        return userId ? await this.getUser(userId) : null;
    }
}