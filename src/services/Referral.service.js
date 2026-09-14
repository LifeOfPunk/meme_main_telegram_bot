import redis from '../redis.js';
import { UserService } from './User.service.js';
import { REFERRAL_BONUS } from '../config.js';

export class ReferralService {
    constructor() {
        this.userService = new UserService();
    }

    // Обработка реферала
    async processReferral(referrerId, newUserId) {
        try {
            // Проверка на самореферал
            if (referrerId === newUserId) {
                console.log(`⚠️ Self-referral blocked: ${referrerId}`);
                return false;
            }

            // Проверка: новый пользователь уже использовал реферальную ссылку?
            const existingReferrer = await redis.get(`user_referrer:${newUserId}`);
            if (existingReferrer) {
                console.log(`⚠️ User ${newUserId} already used referral from ${existingReferrer}`);
                return false;
            }

            // Проверка: новый пользователь уже использовал экспертную ссылку?
            const existingExpert = await redis.get(`expert_referral:${newUserId}`);
            if (existingExpert) {
                console.log(`⚠️ User ${newUserId} already used expert referral from ${existingExpert}, cannot use regular referral`);
                return false;
            }

            const referrer = await this.userService.getUser(referrerId);
            if (!referrer) {
                console.log(`⚠️ Referrer ${referrerId} not found`);
                return false;
            }

            // Проверяем, не был ли уже засчитан этот реферал
            if (referrer.referredUsers && referrer.referredUsers.includes(newUserId)) {
                console.log(`⚠️ Referral ${newUserId} already counted for ${referrerId}`);
                return false;
            }

            // Сохраняем связь пользователь-реферер (навсегда)
            await redis.set(`user_referrer:${newUserId}`, referrerId);
            
            // Даем новому пользователю 1 бесплатную генерацию
            await this.userService.addFreeQuota(newUserId, REFERRAL_BONUS);
            
            // Обновляем список рефералов
            const updatedReferredUsers = [...(referrer.referredUsers || []), newUserId];
            await this.userService.updateUser(referrerId, { 
                referredUsers: updatedReferredUsers,
                totalReferrals: (referrer.totalReferrals || 0) + 1
            });
            
            // Логируем активность
            await this.logReferralActivity(referrerId, newUserId);
            
            console.log(`✅ Referral processed: ${referrerId} -> ${newUserId}`);
            return true;
        } catch (err) {
            console.error(`❌ Error processing user referral: ${err.message}`);
            return false;
        }
    }

    // Обработка экспертного реферала
    async processExpertReferral(expertId, newUserId) {
        try {
            if (expertId === newUserId) {
                console.log(`⚠️ Self-referral blocked: ${expertId}`);
                return false;
            }

            // Проверка: новый пользователь уже использовал экспертную ссылку?
            const existingExpert = await redis.get(`expert_referral:${newUserId}`);
            if (existingExpert) {
                console.log(`⚠️ User ${newUserId} already used expert referral from ${existingExpert}`);
                return false;
            }

            // Проверка: новый пользователь уже использовал обычную реферальную ссылку?
            const existingReferrer = await redis.get(`user_referrer:${newUserId}`);
            if (existingReferrer) {
                console.log(`⚠️ User ${newUserId} already used regular referral from ${existingReferrer}, cannot use expert referral`);
                return false;
            }

            const expert = await this.userService.getUser(expertId);
            if (!expert) {
                console.log(`⚠️ Expert ${expertId} not found`);
                return false;
            }

            // Сохраняем связь эксперт-реферал (навсегда)
            await redis.set(`expert_referral:${newUserId}`, expertId);

            // Даем новому пользователю +1 бесплатную генерацию за переход по ссылке
            await this.userService.addFreeQuota(newUserId, REFERRAL_BONUS);

            // Обновляем список экспертных рефералов
            const updatedExpertReferrals = [...(expert.expertReferrals || []), newUserId];
            await this.userService.updateUser(expertId, { 
                expertReferrals: updatedExpertReferrals,
                totalReferrals: (expert.totalReferrals || 0) + 1
            });

            // Логируем для антиабуз анализа
            await this.logReferralActivity(expertId, newUserId, 'expert');

            console.log(`✅ Expert referral processed: ${expertId} -> ${newUserId}`);
            return true;
        } catch (err) {
            console.error(`❌ Error processing expert referral: ${err.message}`);
            return false;
        }
    }

    // Логирование активности для антиабуз анализа
    async logReferralActivity(referrerId, newUserId, type = 'user') {
        try {
            const activityId = `REF_ACTIVITY-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
            const activity = {
                activityId,
                referrerId,
                newUserId,
                type,
                timestamp: new Date().toISOString(),
                date: new Date().toISOString().split('T')[0]
            };
            
            // Сохраняем активность
            await redis.set(`ref_activity:${activityId}`, JSON.stringify(activity));
            await redis.lpush(`ref_activities:${referrerId}`, activityId);
            
            // Проверяем подозрительную активность (больше 10 рефералов за день)
            const todayActivities = await redis.lrange(`ref_activities:${referrerId}`, 0, -1);
            let todayCount = 0;
            
            for (const id of todayActivities) {
                const act = await redis.get(`ref_activity:${id}`);
                if (act) {
                    const parsed = JSON.parse(act);
                    if (parsed.date === activity.date) {
                        todayCount++;
                    }
                }
            }
            
            if (todayCount > 10) {
                console.log(`⚠️ SUSPICIOUS ACTIVITY: User ${referrerId} has ${todayCount} referrals today`);
                // Можно добавить флаг для модерации
                await redis.set(`suspicious_referrer:${referrerId}`, Date.now());
            }
        } catch (err) {
            console.error(`❌ Error logging referral activity: ${err.message}`);
        }
    }

    // Начисление кешбэка эксперту при оплате (двухуровневая система)
    async processExpertCashback(userId, amount) {
        try {
            // Первая линия: прямой реферал эксперта (25%)
            const level1ExpertId = await redis.get(`expert_referral:${userId}`);
            
            const results = [];
            
            if (level1ExpertId) {
                const cashback1 = (amount * 25) / 100; // 25% для первой линии
                
                const cashbackId1 = `CASHBACK-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
                const cashbackData1 = {
                    cashbackId: cashbackId1,
                    expertId: level1ExpertId,
                    userId,
                    amount: cashback1,
                    originalAmount: amount,
                    percent: 25,
                    level: 1,
                    createdAt: new Date().toISOString()
                };

                await redis.set(`cashback:${cashbackId1}`, JSON.stringify(cashbackData1));
                await redis.lpush(`expert_cashbacks:${level1ExpertId}`, cashbackId1);

                // Обновляем баланс эксперта первой линии
                const expert1 = await this.userService.getUser(level1ExpertId);
                const totalCashback1 = (expert1.totalCashback || 0) + cashback1;
                await this.userService.updateUser(level1ExpertId, { totalCashback: totalCashback1 });

                console.log(`💰 Level 1 Cashback ${cashback1} USDT (25%) credited to expert ${level1ExpertId}`);
                results.push(cashbackData1);
                
                // Вторая линия: эксперт, который привел эксперта первой линии (10%)
                const level2ExpertId = await redis.get(`expert_referral:${level1ExpertId}`);
                
                if (level2ExpertId) {
                    const cashback2 = (amount * 10) / 100; // 10% для второй линии
                    
                    const cashbackId2 = `CASHBACK-${Date.now()}-${Math.floor(Math.random() * 10000) + 10000}`;
                    const cashbackData2 = {
                        cashbackId: cashbackId2,
                        expertId: level2ExpertId,
                        userId,
                        throughExpert: level1ExpertId,
                        amount: cashback2,
                        originalAmount: amount,
                        percent: 10,
                        level: 2,
                        createdAt: new Date().toISOString()
                    };

                    await redis.set(`cashback:${cashbackId2}`, JSON.stringify(cashbackData2));
                    await redis.lpush(`expert_cashbacks:${level2ExpertId}`, cashbackId2);

                    // Обновляем баланс эксперта второй линии
                    const expert2 = await this.userService.getUser(level2ExpertId);
                    const totalCashback2 = (expert2.totalCashback || 0) + cashback2;
                    await this.userService.updateUser(level2ExpertId, { totalCashback: totalCashback2 });

                    console.log(`💰 Level 2 Cashback ${cashback2} USDT (10%) credited to expert ${level2ExpertId}`);
                    results.push(cashbackData2);
                }
            }
            
            return results.length > 0 ? results : null;
        } catch (err) {
            console.error(`❌ Error processing cashback: ${err.message}`);
            return null;
        }
    }

    // Получение статистики рефералов
    async getReferralStats(userId) {
        const user = await this.userService.getUser(userId);
        if (!user) return null;

        return {
            referredUsers: user.referredUsers?.length || 0,
            expertReferrals: user.expertReferrals?.length || 0,
            totalCashback: user.totalCashback || 0
        };
    }

    // Добавить пользователя в эксперты
    async addExpert(userId) {
        try {
            const user = await this.userService.getUser(userId);
            if (!user) {
                console.log(`❌ User ${userId} not found`);
                return { success: false, error: 'Пользователь не найден' };
            }

            // Проверяем, не является ли уже экспертом
            const isExpert = await redis.get(`expert:${userId}`);
            if (isExpert) {
                console.log(`⚠️ User ${userId} is already an expert`);
                return { success: false, error: 'Пользователь уже является экспертом' };
            }

            // Добавляем в список экспертов
            await redis.set(`expert:${userId}`, 'true');
            await redis.sadd('all_experts', userId.toString());

            // Обновляем данные пользователя
            await this.userService.updateUser(userId, { 
                isExpert: true,
                expertSince: new Date().toISOString()
            });

            console.log(`✅ User ${userId} added as expert`);
            return { success: true, userId };
        } catch (err) {
            console.error(`❌ Error adding expert: ${err.message}`);
            return { success: false, error: err.message };
        }
    }

    // Удалить пользователя из экспертов
    async removeExpert(userId) {
        try {
            const user = await this.userService.getUser(userId);
            if (!user) {
                console.log(`❌ User ${userId} not found`);
                return { success: false, error: 'Пользователь не найден' };
            }

            // Проверяем, является ли экспертом
            const isExpert = await redis.get(`expert:${userId}`);
            if (!isExpert) {
                console.log(`⚠️ User ${userId} is not an expert`);
                return { success: false, error: 'Пользователь не является экспертом' };
            }

            // Удаляем из списка экспертов
            await redis.del(`expert:${userId}`);
            await redis.srem('all_experts', userId.toString());

            // Обновляем данные пользователя
            await this.userService.updateUser(userId, { 
                isExpert: false
            });

            console.log(`✅ User ${userId} removed from experts`);
            return { success: true, userId };
        } catch (err) {
            console.error(`❌ Error removing expert: ${err.message}`);
            return { success: false, error: err.message };
        }
    }

    // Проверить, является ли пользователь экспертом
    async isExpert(userId) {
        try {
            const isExpert = await redis.get(`expert:${userId}`);
            return !!isExpert;
        } catch (err) {
            console.error(`❌ Error checking expert status: ${err.message}`);
            return false;
        }
    }

    // Получить список всех экспертов
    async getAllExperts() {
        try {
            const expertIds = await redis.smembers('all_experts');
            const experts = [];

            for (const id of expertIds) {
                const user = await this.userService.getUser(parseInt(id));
                if (user) {
                    const stats = await this.getReferralStats(parseInt(id));
                    experts.push({
                        userId: user.userId,
                        firstName: user.firstName,
                        username: user.username,
                        expertSince: user.expertSince,
                        ...stats
                    });
                }
            }

            return experts;
        } catch (err) {
            console.error(`❌ Error getting all experts: ${err.message}`);
            return [];
        }
    }
}