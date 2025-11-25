#!/usr/bin/env node
import { UserService } from './src/services/User.service.js';

const userService = new UserService();
const userId = process.argv[2];

if (!userId) {
    console.log('Usage: node check_user.js <userId>');
    process.exit(1);
}

const user = await userService.getUserById(parseInt(userId));

if (user) {
    console.log('👤 Пользователь:', userId);
    console.log('📝 Имя:', user.firstName);
    console.log('🎁 Бесплатных генераций:', user.free_quota || 0);
    console.log('💎 Платных генераций:', user.paid_quota || 0);
    console.log('✅ Использовано бесплатных:', user.used_free_quota || 0);
    console.log('💰 Использовано платных:', user.used_paid_quota || 0);
    console.log('💵 Потрачено:', user.total_spent || 0, '₽');
} else {
    console.log('❌ Пользователь не найден');
}

process.exit(0);
