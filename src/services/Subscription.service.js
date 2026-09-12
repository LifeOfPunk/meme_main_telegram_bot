/**
 * Сервис проверки подписки на канал
 */
export class SubscriptionService {
    constructor(bot) {
        this.bot = bot;
        this.requiredChannel = process.env.REQUIRED_CHANNEL || '@aiviral_official';
        this.requiredChannelId = process.env.REQUIRED_CHANNEL_ID;
    }

    /**
     * Проверить подписку пользователя на канал
     * @param {number} userId - ID пользователя
     * @returns {Promise<boolean>} - true если подписан
     */
    async checkSubscription(userId) {
        try {
            // Если ID канала не указан, пропускаем проверку
            if (!this.requiredChannelId) {
                console.log('⚠️ REQUIRED_CHANNEL_ID not set, skipping subscription check');
                return true;
            }

            console.log(`🔍 Checking subscription: userId=${userId}, channelId=${this.requiredChannelId}`);

            // Получаем информацию о пользователе в канале
            const member = await this.bot.telegram.getChatMember(this.requiredChannelId, userId);
            
            console.log(`📊 Member status: ${member.status}`);
            
            // Проверяем статус: member, administrator, creator
            const isSubscribed = ['member', 'administrator', 'creator'].includes(member.status);
            
            console.log(`🔍 Subscription check for user ${userId}: ${isSubscribed ? '✅ subscribed' : '❌ not subscribed'} (status: ${member.status})`);
            
            return isSubscribed;
        } catch (err) {
            console.error(`❌ Error checking subscription for user ${userId}:`, {
                message: err.message,
                code: err.response?.error_code,
                description: err.response?.description
            });
            
            // Если пользователь не найден в канале или канал не найден
            if (err.response?.error_code === 400) {
                console.log(`❌ User ${userId} not subscribed to channel (400 error)`);
                return false;
            }
            
            // В случае других ошибок API пропускаем проверку
            console.log(`⚠️ Skipping subscription check due to error`);
            return true;
        }
    }

    /**
     * Получить клавиатуру с кнопкой подписки (первое сообщение)
     * @returns {object} - Inline клавиатура
     */
    getSubscriptionKeyboard() {
        return {
            inline_keyboard: [
                [{ 
                    text: '✅ Подписаться', 
                    url: `https://t.me/${this.requiredChannel.replace('@', '')}` 
                }],
                [{ 
                    text: '🔙 Назад', 
                    callback_data: 'main_menu' 
                }]
            ]
        };
    }

    /**
     * Получить клавиатуру после подписки (успех)
     * @returns {object} - Inline клавиатура
     */
    getAfterSubscriptionKeyboard() {
        return {
            inline_keyboard: [
                [{ 
                    text: '🎁 Бесплатная генерация', 
                    callback_data: 'create_video_free' 
                }],
                [{ 
                    text: '🔙 Главное меню', 
                    callback_data: 'main_menu' 
                }]
            ]
        };
    }

    /**
     * Получить клавиатуру если не подписался (повтор)
     * @returns {object} - Inline клавиатура
     */
    getNotSubscribedKeyboard() {
        return {
            inline_keyboard: [
                [{ 
                    text: '✅ Подписаться', 
                    url: `https://t.me/${this.requiredChannel.replace('@', '')}` 
                }],
                [{ 
                    text: '✔️ Я подписался, проверить', 
                    callback_data: 'check_subscription' 
                }],
                [{ 
                    text: '🔙 Главное меню', 
                    callback_data: 'main_menu' 
                }]
            ]
        };
    }

    /**
     * Получить сообщение о необходимости подписки (первое)
     * @returns {string} - Текст сообщения
     */
    getSubscriptionMessage() {
        return `🎁 Чтобы получить бесплатную генерацию подпишись на наш Telegram-канал.\n\n` +
               `📢 Здесь ты найдешь:\n` +
               `• Новости и обновления\n` +
               `• Полезные советы по созданию вирусных видео\n` +
               `• Эксклюзивный контент\n` +
               `• Бонусы подарки и призы`;
    }

    /**
     * Получить сообщение после успешной подписки
     * @returns {string} - Текст сообщения
     */
    getSubscribedMessage() {
        return `🥳 Рады видеть что ты подписался!\n\n` +
               `Нажимай кнопку "🎁 Бесплатная генерация" и быстрее беги создавать свое первое видео!`;
    }

    /**
     * Получить сообщение если не подписался
     * @returns {string} - Текст сообщения
     */
    getNotSubscribedMessage() {
        return `🥲 Сначала подпишись на наш Телеграм Канал, после чего мы начислим тебе бесплатную генерацию!\n\n` +
               `Нажимай кнопку "✅ Подписаться"!`;
    }
}
