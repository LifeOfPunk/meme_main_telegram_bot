import 'dotenv/config';
import { UserService } from './src/services/User.service.js';

const userService = new UserService();

async function checkUser() {
    try {
        const userId = 1048912079;
        const user = await userService.getUser(userId);
        
        console.log('👤 Информация о пользователе', userId);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        
        if (!user) {
            console.log('❌ Пользователь не найден в базе');
            console.log('');
            console.log('Это означает что пользователь НЕ нажимал /start в текущем боте.');
            console.log('Он должен написать /start боту @aiviral_academy_bot');
        } else {
            console.log('✅ Пользователь найден в базе');
            console.log('');
            console.log('Данные:');
            console.log(JSON.stringify(user, null, 2));
        }
        
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Ошибка:', error);
        process.exit(1);
    }
}

checkUser();
