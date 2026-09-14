import crypto from 'crypto';
import redis, { stagingRedis } from '../redis.js';
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

            // Автодублирование создания пользователя в стейджинг
            if (stagingRedis) {
                try {
                    const stagingRaw = await stagingRedis.get(`user:${userId}`);
                    if (!stagingRaw) {
                        await stagingRedis.set(`user:${userId}`, JSON.stringify(newUser));
                        await stagingRedis.sadd('all_users', userId);
                    }
                } catch (err) {
                    console.warn(`⚠️ Dual-write createUser to Staging Redis failed: ${err.message}`);
                }
            }

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

        // Автодублирование обновления пользователя в стейджинг (если подключен STAGING_REDIS_URL)
        if (stagingRedis) {
            try {
                const stagingRaw = await stagingRedis.get(`user:${userId}`);
                if (stagingRaw) {
                    const stagingUser = JSON.parse(stagingRaw);
                    const merged = { ...stagingUser, ...data, updatedAt: new Date().toISOString() };
                    await stagingRedis.set(`user:${userId}`, JSON.stringify(merged));
                } else {
                    await stagingRedis.set(`user:${userId}`, JSON.stringify(updatedUser));
                    await stagingRedis.sadd('all_users', userId);
                }
                console.log(`🔄 Dual-write user ${userId} to Staging Redis synced`);
            } catch (err) {
                console.warn(`⚠️ Dual-write updateUser to Staging Redis failed: ${err.message}`);
            }
        }

        return updatedUser;
    }

    // ── P1-09: атомарные мутации баланса/квот через per-user Redis-lock ──
    async _acquireLock(userId, ttlMs = 5000) {
        const token = crypto.randomBytes(12).toString('hex');
        const key = `user_lock:${userId}`;
        for (let i = 0; i < 60; i++) {
            const ok = await redis.set(key, token, 'PX', ttlMs, 'NX');
            if (ok === 'OK') return token;
            await new Promise(r => setTimeout(r, 15 + Math.floor(Math.random() * 25)));
        }
        return null;
    }

    async _releaseLock(userId, token) {
        try {
            await redis.eval(
                "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end",
                1, `user_lock:${userId}`, token
            );
        } catch (err) { /* best-effort release */ }
    }

    async _mirrorToStaging(userId, user) {
        if (!stagingRedis) return;
        try { await stagingRedis.set(`user:${userId}`, JSON.stringify(user)); }
        catch (err) { /* best-effort dual-write */ }
    }

    // mutator(user) -> { commit: boolean, ret?: any }. Read-modify-write под блокировкой.
    async _lockedUpdate(userId, mutator) {
        const token = await this._acquireLock(userId);
        if (!token) { console.warn(`⚠️ user lock timeout for ${userId}`); return { ok: false, reason: 'lock_timeout' }; }
        try {
            const raw = await redis.get(`user:${userId}`);
            if (!raw) return { ok: false, reason: 'user_not_found' };
            const user = JSON.parse(raw);
            const decision = mutator(user);
            if (!decision || decision.commit === false) return { ok: false, ret: decision ? decision.ret : false };
            user.updatedAt = new Date().toISOString();
            await redis.set(`user:${userId}`, JSON.stringify(user));
            await this._mirrorToStaging(userId, user);
            return { ok: true, ret: decision.ret, user };
        } finally {
            await this._releaseLock(userId, token);
        }
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
        const r = await this._lockedUpdate(userId, (user) => {
            if ((user.free_quota || 0) <= 0) return { commit: false, ret: false };
            user.free_quota = Number(user.free_quota) - 1;
            user.used_free_quota = (user.used_free_quota || 0) + 1;
            return { commit: true, ret: true };
        });
        if (r.ok) console.log(`⚖️ User ${userId}: deducted 1 free quota (atomic).`);
        return r.ok ? r.ret : false;
    }

    // Списание платной квоты
    async deductPaidQuota(userId) {
        const r = await this._lockedUpdate(userId, (user) => {
            if ((user.paid_quota || 0) <= 0) return { commit: false, ret: false };
            user.paid_quota = Number(user.paid_quota) - 1;
            user.used_paid_quota = (user.used_paid_quota || 0) + 1;
            return { commit: true, ret: true };
        });
        if (r.ok) console.log(`⚖️ User ${userId}: deducted 1 paid quota (atomic).`);
        return r.ok ? r.ret : false;
    }

    // Списание с баланса кошелька в USDT (TASK-15)
    async deductWalletBalance(userId, amount = GENERATION_COST_USDT) {
        const r = await this._lockedUpdate(userId, (user) => {
            const balance = Number(user.wallet_balance_usdt || 0);
            if (balance < amount) return { commit: false, ret: false };
            user.wallet_balance_usdt = Number((balance - amount).toFixed(2));
            user.total_spent = Number(((user.total_spent || 0) + amount).toFixed(2));
            return { commit: true, ret: true };
        });
        if (r.ok) console.log(`⚖️ User ${userId}: deducted ${amount} USDT from wallet (atomic).`);
        return r.ok ? r.ret : false;
    }

    // Пополнение баланса кошелька в USDT (TASK-15)
    async addWalletBalance(userId, amount) {
        const add = Number(amount);
        if (!isFinite(add) || add <= 0) return false;
        const r = await this._lockedUpdate(userId, (user) => {
            const currentBalance = Number(user.wallet_balance_usdt || 0);
            user.wallet_balance_usdt = Number((currentBalance + add).toFixed(2));
            return { commit: true, ret: true };
        });
        if (r.ok) console.log(`💰 User ${userId}: added ${add} USDT to wallet (atomic).`);
        return r.ok ? r.ret : false;
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
        if (type === 'balance') {
            const r = await this._lockedUpdate(userId, (user) => {
                const bal = Number(user.wallet_balance_usdt || 0);
                user.wallet_balance_usdt = Number((bal + GENERATION_COST_USDT).toFixed(2));
                if ((user.total_spent || 0) >= GENERATION_COST_USDT) {
                    user.total_spent = Number(((user.total_spent || 0) - GENERATION_COST_USDT).toFixed(2));
                }
                return { commit: true, ret: true };
            });
            if (r.ok) console.log(`↩️ User ${userId}: refunded ${GENERATION_COST_USDT} USDT (atomic).`);
            return r.ok ? r.ret : false;
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
        if (isPaid === 'balance') {
            return await this.refundGenerationCost(userId, 'balance');
        }
        const r = await this._lockedUpdate(userId, (user) => {
            if (isPaid === true || isPaid === 'paid') {
                user.paid_quota = Number(user.paid_quota || 0) + 1;
            } else {
                user.free_quota = Number(user.free_quota || 0) + 1;
            }
            return { commit: true, ret: true };
        });
        if (r.ok) console.log(`↩️ User ${userId}: refunded 1 quota (atomic).`);
        return r.ok ? r.ret : false;
    }

    // Добавление платных генераций
    async addPaidQuota(userId, amount) {
        const add = Number(amount);
        if (!isFinite(add) || add <= 0) return false;
        const r = await this._lockedUpdate(userId, (user) => {
            user.paid_quota = Number(user.paid_quota || 0) + add;
            return { commit: true, ret: true };
        });
        if (r.ok) console.log(`💳 User ${userId}: added ${add} paid generations (atomic).`);
        return r.ok ? r.ret : false;
    }

    // Добавление бесплатных генераций (реферальные бонусы)
    async addFreeQuota(userId, amount) {
        const add = Number(amount);
        if (!isFinite(add) || add <= 0) return false;
        const r = await this._lockedUpdate(userId, (user) => {
            user.free_quota = Number(user.free_quota || 0) + add;
            return { commit: true, ret: true };
        });
        if (r.ok) console.log(`🎁 User ${userId}: added ${add} free generations (atomic).`);
        return r.ok ? r.ret : false;
    }

    // Уменьшение бесплатных генераций (админ)
    async removeFreeQuota(userId, amount) {
        const r = await this._lockedUpdate(userId, (user) => {
            user.free_quota = Math.max(0, Number(user.free_quota || 0) - Number(amount));
            return { commit: true, ret: true };
        });
        if (r.ok) console.log(`➖ User ${userId}: removed ${amount} free generations (atomic).`);
        return r.ok ? r.ret : false;
    }

    // Установка точного количества бесплатных генераций (админ)
    async setFreeQuota(userId, amount) {
        const r = await this._lockedUpdate(userId, (user) => {
            user.free_quota = Number(amount);
            return { commit: true, ret: true };
        });
        if (r.ok) console.log(`⚙️ User ${userId}: set free quota to ${amount} (atomic).`);
        return r.ok ? r.ret : false;
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