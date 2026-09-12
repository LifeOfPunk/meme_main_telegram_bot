import redis from '../redis.js';
import { FREE_QUOTA_PER_USER } from '../config.js';
import { REDIS_KEYS } from '../config/redisKeys.js';

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

    // Списание бесплатной квоты
    async deductFreeQuota(userId) {
        const user = await this.getUser(userId);
        if (!user || user.free_quota <= 0) return false;

        user.free_quota -= 1;
        user.used_free_quota = (user.used_free_quota || 0) + 1;
        await this.updateUser(userId, { 
            free_quota: user.free_quota,
            used_free_quota: user.used_free_quota
        });
        console.log(`⚖️ User ${userId}: deducted 1 free quota. Remaining: ${user.free_quota}`);
        return true;
    }

    // Списание платной квоты
    async deductPaidQuota(userId) {
        const user = await this.getUser(userId);
        if (!user || user.paid_quota <= 0) return false;

        user.paid_quota -= 1;
        user.used_paid_quota = (user.used_paid_quota || 0) + 1;
        await this.updateUser(userId, { 
            paid_quota: user.paid_quota,
            used_paid_quota: user.used_paid_quota
        });
        console.log(`⚖️ User ${userId}: deducted 1 paid quota. Remaining: ${user.paid_quota}`);
        return true;
    }

    // Списание квоты (с поддержкой режима: 'free', 'paid', 'any')
    async deductQuota(userId, mode = 'any') {
        if (mode === 'free') return await this.deductFreeQuota(userId);
        if (mode === 'paid') return await this.deductPaidQuota(userId);

        if (await this.deductFreeQuota(userId)) return true;
        return await this.deductPaidQuota(userId);
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

    // Проверка, забирал ли пользователь подарок за подписку на соцсети
    async hasClaimedSocialGift(userId) {
        const claimedKey = REDIS_KEYS.SOCIAL_GIFT_CLAIMED(userId);
        const claimed = await redis.get(claimedKey);
        if (claimed) return true;

        const user = await this.getUser(userId);
        return !!(user && user.claimed_social_gift_at);
    }

    // Сохранение лид-данных соцсетей
    async saveSocialLead(userId, leadData) {
        const lead = {
            telegram_id: userId,
            username: leadData.username || null,
            first_name: leadData.first_name || null,
            instagram_handle: leadData.instagram_handle || null,
            youtube_handle: leadData.youtube_handle || null,
            tiktok_handle: leadData.tiktok_handle || null,
            claimed_gift_at: new Date().toISOString()
        };

        const leadKey = REDIS_KEYS.SOCIAL_LEAD(userId);
        await redis.set(leadKey, JSON.stringify(lead));
        await redis.sadd(REDIS_KEYS.ALL_SOCIAL_LEADS, userId);

        await this.updateUser(userId, {
            social_lead: lead,
            claimed_social_gift_at: lead.claimed_gift_at
        });

        console.log(`📋 Saved social lead for user ${userId}: IG=${lead.instagram_handle || 'N/A'}, YT=${lead.youtube_handle || 'N/A'}`);
        return lead;
    }

    // Начисление подарка за подписку с защитой от повторного сбора
    async claimSocialGift(userId, leadData, bonusGenerations = 1) {
        const alreadyClaimed = await this.hasClaimedSocialGift(userId);
        if (alreadyClaimed) {
            console.log(`⚠️ User ${userId} already claimed social gift, blocking duplicate`);
            return { success: false, alreadyClaimed: true };
        }

        // Устанавливаем флаг получения подарка
        const claimedKey = REDIS_KEYS.SOCIAL_GIFT_CLAIMED(userId);
        await redis.set(claimedKey, new Date().toISOString());

        // Сохраняем лид-данные
        const lead = await this.saveSocialLead(userId, leadData);

        // Начисляем бонусные генерации
        await this.addFreeQuota(userId, bonusGenerations);
        console.log(`🎁 User ${userId} granted ${bonusGenerations} bonus generation(s) for social subscription`);

        return {
            success: true,
            bonusGenerations,
            lead
        };
    }

    // Получение сохраненного соц-лида
    async getSocialLead(userId) {
        const leadKey = REDIS_KEYS.SOCIAL_LEAD(userId);
        const data = await redis.get(leadKey);
        return data ? JSON.parse(data) : null;
    }

    // Получение всех сохраненных соц-лидов (для экспорта и админ-панели)
    async getAllSocialLeads() {
        const userIds = await redis.smembers(REDIS_KEYS.ALL_SOCIAL_LEADS);
        const leads = [];
        for (const userId of userIds) {
            const numericId = typeof userId === 'string' ? parseInt(userId) : userId;
            const lead = await this.getSocialLead(numericId);
            if (lead) {
                leads.push(lead);
            }
        }
        console.log(`📊 getAllSocialLeads: found ${leads.length} leads from ${userIds.length} entries`);
        return leads;
    }
}