import 'dotenv/config';
import { UserService } from './src/services/User.service.js';

const userService = new UserService();

async function addUser() {
    try {
        const userId = 583561687;
        
        console.log('🔍 Проверяю пользователя', userId);
        
        const existingUser = await userService.getUser(userId);
        
        if (existingUser) {
            console.log('✅ Пользователь уже есть в базе');
            console.log(JSON.stringify(existingUser, null, 2));
        } else {
            console.log('➕ Добавляю пользователя в базу...');
            
            // Создаем пользователя с минимальными данными
            const userData = {
                id: userId,
                first_name: 'User',
                username: null,
                last_name: null
            };
            
            await userService.createUser(userData);
            
            console.log('✅ Пользователь успешно добавлен!');
            
            const newUser = await userService.getUser(userId);
            console.log('');
            console.log('Данные:');
            console.log(JSON.stringify(newUser, null, 2));
        }
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Ошибка:', error);
        process.exit(1);
    }
}

addUser();
