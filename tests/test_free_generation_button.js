import 'dotenv/config';
import { UserService } from './src/services/User.service.js';
import { createMainMenuKeyboard } from './src/screens/keyboards.js';
import redis from './src/redis.js';

const userService = new UserService();

async function testFreeGenerationButton() {
    console.log('🧪 Testing Free Generation Button Feature\n');
    
    try {
        // Тест 1: Создаём пользователя с бесплатными генерациями
        console.log('Test 1: User with free generations');
        const testUserId1 = 999999991;
        
        // Создаём тестового пользователя
        await userService.createUser({
            id: testUserId1,
            username: 'test_user_1',
            first_name: 'Test',
            last_name: 'User'
        });
        
        const user1 = await userService.getUser(testUserId1);
        console.log(`✅ User created: free_quota = ${user1.free_quota}`);
        
        // Генерируем клавиатуру
        const keyboard1 = await createMainMenuKeyboard(testUserId1);
        console.log(`✅ Keyboard generated with ${keyboard1.inline_keyboard.length} buttons`);
        
        // Проверяем наличие кнопки бесплатной генерации
        const hasFreeButton1 = keyboard1.inline_keyboard.some(row => 
            row.some(button => button.callback_data === 'use_free_generation')
        );
        console.log(`✅ Free generation button visible: ${hasFreeButton1}`);
        
        if (hasFreeButton1) {
            const freeButton = keyboard1.inline_keyboard.find(row => 
                row.some(button => button.callback_data === 'use_free_generation')
            )[0];
            console.log(`✅ Button text: "${freeButton.text}"`);
        }
        
        console.log('\n---\n');
        
        // Тест 2: Пользователь без бесплатных генераций
        console.log('Test 2: User without free generations');
        const testUserId2 = 999999992;
        
        await userService.createUser({
            id: testUserId2,
            username: 'test_user_2',
            first_name: 'Test2',
            last_name: 'User2'
        });
        
        // Убираем бесплатные генерации
        await userService.updateUser(testUserId2, { free_quota: 0 });
        
        const user2 = await userService.getUser(testUserId2);
        console.log(`✅ User created: free_quota = ${user2.free_quota}`);
        
        const keyboard2 = await createMainMenuKeyboard(testUserId2);
        console.log(`✅ Keyboard generated with ${keyboard2.inline_keyboard.length} buttons`);
        
        const hasFreeButton2 = keyboard2.inline_keyboard.some(row => 
            row.some(button => button.callback_data === 'use_free_generation')
        );
        console.log(`✅ Free generation button visible: ${hasFreeButton2}`);
        
        console.log('\n---\n');
        
        // Тест 3: Пользователь с несколькими бесплатными генерациями
        console.log('Test 3: User with multiple free generations');
        const testUserId3 = 999999993;
        
        await userService.createUser({
            id: testUserId3,
            username: 'test_user_3',
            first_name: 'Test3',
            last_name: 'User3'
        });
        
        // Добавляем больше бесплатных генераций
        await userService.addFreeQuota(testUserId3, 5);
        
        const user3 = await userService.getUser(testUserId3);
        console.log(`✅ User created: free_quota = ${user3.free_quota}`);
        
        const keyboard3 = await createMainMenuKeyboard(testUserId3);
        
        const hasFreeButton3 = keyboard3.inline_keyboard.some(row => 
            row.some(button => button.callback_data === 'use_free_generation')
        );
        console.log(`✅ Free generation button visible: ${hasFreeButton3}`);
        
        if (hasFreeButton3) {
            const freeButton = keyboard3.inline_keyboard.find(row => 
                row.some(button => button.callback_data === 'use_free_generation')
            )[0];
            console.log(`✅ Button text: "${freeButton.text}"`);
        }
        
        console.log('\n✅ All tests passed!\n');
        
        // Очистка тестовых данных
        console.log('🧹 Cleaning up test data...');
        await redis.del(`user:${testUserId1}`);
        await redis.del(`user:${testUserId2}`);
        await redis.del(`user:${testUserId3}`);
        await redis.srem('all_users', testUserId1, testUserId2, testUserId3);
        console.log('✅ Cleanup complete');
        
    } catch (err) {
        console.error('❌ Test failed:', err);
    } finally {
        await redis.quit();
        process.exit(0);
    }
}

testFreeGenerationButton();
