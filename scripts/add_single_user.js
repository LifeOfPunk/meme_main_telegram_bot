import 'dotenv/config';
import { UserService } from './src/services/User.service.js';

const userService = new UserService();
const userId = 1056256169;

async function addUser() {
    try {
        console.log(`📥 Adding user ${userId}...\n`);
        
        // Проверяем существует ли пользователь
        const existingUser = await userService.getUser(userId);
        
        if (existingUser) {
            console.log(`✓ User ${userId} already exists`);
            console.log(`Current quota: ${existingUser.free_quota} free, ${existingUser.paid_quota} paid`);
        } else {
            // Создаём пользователя
            const userData = {
                id: userId,
                username: undefined,
                first_name: 'User',
                last_name: ''
            };
            
            await userService.createUser(userData, 'manual_add');
            
            // Добавляем 1 бесплатную генерацию
            await userService.addFreeQuota(userId, 1);
            
            console.log(`✅ User ${userId} added with 1 free quota`);
        }
        
        process.exit(0);
    } catch (err) {
        console.error('❌ Error:', err);
        process.exit(1);
    }
}

addUser();
