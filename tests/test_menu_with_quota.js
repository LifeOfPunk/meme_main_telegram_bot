import 'dotenv/config';
import { UserService } from '../src/services/User.service.js';

const userService = new UserService();

async function testMenuWithQuota() {
    console.log('🧪 Testing menu visibility with quota...\n');
    
    const testUserId = 583561687;
    
    // Добавляем квоту
    console.log('➕ Adding 1 free quota...');
    await userService.updateUser(testUserId, { free_quota: 1 });
    
    // Получаем пользователя
    const user = await userService.getUser(testUserId);
    
    console.log('\n👤 User info:');
    console.log(`   User ID: ${testUserId}`);
    console.log(`   Free quota: ${user.free_quota || 0}`);
    console.log(`   Paid quota: ${user.paid_quota || 0}`);
    console.log(`   Total quota: ${(user.free_quota || 0) + (user.paid_quota || 0)}`);
    
    const totalQuota = (user.free_quota || 0) + (user.paid_quota || 0);
    
    console.log('\n📋 Menu visibility:');
    if (user.free_quota > 0) {
        console.log('   ✅ "Бесплатный мем" button VISIBLE (free_quota > 0)');
    } else {
        console.log('   ❌ "Бесплатный мем" button HIDDEN (free_quota = 0)');
    }
    
    // Тест с paid_quota (не должна показывать кнопку)
    console.log('\n➖ Removing free_quota, adding paid_quota...');
    await userService.updateUser(testUserId, { free_quota: 0, paid_quota: 5 });
    
    const userWithPaid = await userService.getUser(testUserId);
    
    console.log('\n👤 User with paid quota:');
    console.log(`   Free quota: ${userWithPaid.free_quota || 0}`);
    console.log(`   Paid quota: ${userWithPaid.paid_quota || 0}`);
    
    console.log('\n📋 Menu visibility with only paid quota:');
    if (userWithPaid.free_quota > 0) {
        console.log('   ✅ "Бесплатный мем" button VISIBLE (free_quota > 0)');
    } else {
        console.log('   ❌ "Бесплатный мем" button HIDDEN (free_quota = 0, even with paid_quota)');
    }
    
    // Убираем квоту обратно
    console.log('\n➖ Removing all quota...');
    await userService.updateUser(testUserId, { free_quota: 0, paid_quota: 0 });
    
    const userAfter = await userService.getUser(testUserId);
    
    console.log('\n📋 Menu visibility after removing all quota:');
    if (userAfter.free_quota > 0) {
        console.log('   ✅ "Бесплатный мем" button VISIBLE');
    } else {
        console.log('   ❌ "Бесплатный мем" button HIDDEN');
    }
    
    console.log('\n✅ Test completed!');
    process.exit(0);
}

testMenuWithQuota().catch(err => {
    console.error('❌ Error:', err);
    process.exit(1);
});
