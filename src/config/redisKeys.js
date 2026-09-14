/**
 * Redis Keys configuration
 */
export const REDIS_KEYS = {
    USER: (userId) => `user:${userId}`,
    ALL_USERS: 'all_users',
    SOCIAL_LEAD: (userId) => `social_lead:${userId}`,
    SOCIAL_GIFT_CLAIMED: (userId) => `social_gift_claimed:${userId}`,
    ALL_SOCIAL_LEADS: 'all_social_leads',
    YOUTUBE_TOKENS: (userId) => `youtube_tokens:${userId}`,
    USER_EMAIL: (email) => `user_email:${email}`,
};

export default REDIS_KEYS;
