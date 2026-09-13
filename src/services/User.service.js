import redis from '../redis.js';
import { FREE_QUOTA_PER_USER, GENERATION_COST_USDT } from '../config.js';
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
                wallet_balance_usdt: 0,
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

    // Проверка наличия квот или баланса (TASK-15)
    async hasQuota(userId) {
        const user = await this.getUser(userId);
        if (!user) return false;
        const balance = Number(user.wallet_balance_usdt || 0);
        return (user.free_quota || 0) > 0 || (user.paid_quota || 0) > 0 || balance >= GENERATION_COST_USDT;
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

    // Списание с баланса кошелька в USDT (TASK-15)
    async deductWalletBalance(userId, amount = GENERATION_COST_USDT) {
        const user = await this.getUser(userId);
        if (!user) return false;
        const balance = Number(user.wallet_balance_usdt || 0);
        if (balance < amount) return false;

        const newBalance = Number((balance - amount).toFixed(2));
        const newTotalSpent = Number(((user.total_spent || 0) + amount).toFixed(2));
        await this.updateUser(userId, {
            wallet_balance_usdt: newBalance,
            total_spent: newTotalSpent
        });
        console.log(`⚖️ User ${userId}: deducted ${amount} USDT from wallet. Remaining: ${newBalance} USDT`);
        return true;
    }

    // Пополнение баланса кошелька в USDT (TASK-15)
    async addWalletBalance(userId, amount) {
        const user = await this.getUser(userId);
        if (!user) return false;

        const currentBalance = Number(user.wallet_balance_usdt || 0);
        const newBalance = Number((currentBalance + Number(amount)).toFixed(2));
        await this.updateUser(userId, { wallet_balance_usdt: newBalance });
        console.log(`💰 User ${userId}: added ${amount} USDT to wallet. Total: ${newBalance} USDT`);
        return true;
    }

    // Получить баланс кошелька в USDT (TASK-15)
    async getUserWalletBalance(userId) {
        const user = await this.getUser(userId);
        return Number(user?.wallet_balance_usdt ?? user?.wallet_balance ?? 0);
    }

    // Роутер списания за генерацию видео (TASK-15)
    // 1. Если free_quota > 0 -> расходовать бесплатную квоту.
    // 2. Если paid_quota > 0 или wallet_balance_usdt >= GENERATION_COST_USDT (1.30 USDT) -> расходовать платную квоту / баланс.
    // 3. Если баланс и квоты нулевые -> отказ (insufficient_funds).
    async deductGenerationCost(userId) {
        const user = await this.getUser(userId);
        if (!user) return { success: false, reason: 'user_not_found' };

        // 1. Если free_quota > 0 -> расходовать бесплатную квоту
        if ((user.free_quota || 0) > 0) {
            const deducted = await this.deductFreeQuota(userId);
            return { success: deducted, type: 'free' };
        }

        // 2. Если paid_quota > 0 -> расходовать платную квоту
        if ((user.paid_quota || 0) > 0) {
            const deducted = await this.deductPaidQuota(userId);
            return { success: deducted, type: 'paid' };
        }

        // 3. Если wallet_balance_usdt >= GENERATION_COST_USDT -> расходовать баланс
        const currentBalance = Number(user.wallet_balance_usdt || 0);
        if (currentBalance >= GENERATION_COST_USDT) {
            const deducted = await this.deductWalletBalance(userId, GENERATION_COST_USDT);
            return { success: deducted, type: 'balance', amount: GENERATION_COST_USDT };
        }

        // 4. Баланс и квоты нулевые
        return { success: false, reason: 'insufficient_funds' };
    }

    // Возврат средств / квоты за неудачную генерацию (TASK-15)
    async refundGenerationCost(userId, type = 'free') {
        const user = await this.getUser(userId);
        if (!user) return false;

        if (type === 'balance') {
            await this.addWalletBalance(userId, GENERATION_COST_USDT);
            if ((user.total_spent || 0) >= GENERATION_COST_USDT) {
                await this.updateUser(userId, {
                    total_spent: Number(((user.total_spent || 0) - GENERATION_COST_USDT).toFixed(2))
                });
            }
            console.log(`↩️ User ${userId}: refunded ${GENERATION_COST_USDT} USDT to wallet balance`);
            return true;
        } else if (type === 'paid') {
            return await this.refundQuota(userId, true);
        } else {
            return await this.refundQuota(userId, false);
        }
    }

    // Списание квоты (с поддержкой режима: 'free', 'paid', 'any')
    async deductQuota(userId, mode = 'any') {
        if (mode === 'free') return await this.deductFreeQuota(userId);
        if (mode === 'paid') {
            const user = await this.getUser(userId);
            if ((user?.paid_quota || 0) > 0) {
                return await this.deductPaidQuota(userId);
            }
            return await this.deductWalletBalance(userId, GENERATION_COST_USDT);
        }

        const res = await this.deductGenerationCost(userId);
        return res.success;
    }

    // Возврат квоты при ошибке (с обратной совместимостью)
    async refundQuota(userId, isPaid = false) {
        const user = await this.getUser(userId);
        if (!user) return false;

        if (isPaid === 'balance') {
            return await this.refundGenerationCost(userId, 'balance');
        }

        if (isPaid === true || isPaid === 'paid') {
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