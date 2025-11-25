import 'dotenv/config';
import { UserService } from './src/services/User.service.js';

const userService = new UserService();

// Список ID для добавления
const userIds = [
    470239748,
    7890697185,
    5753228384,
    6339774758,
    5483478010,
    7182440314,
    451709016,
    6397859761,
    6175001160,
    8055158918,
    5138123081,
    6621895105,
    8085537121,
    7629825656,
    6907714971,
    1077117236,
    7324995711,
    6787161338,
    8467577798,
    724310326,
    7965889041,
    5862997386,
    1747057123,
    8098440412,
    7495661474,
    1522808248,
    1199870487,
    7562693262
];

async function addUsers() {
    try {
        console.log('📥 Starting user import...\n');
        console.log(`📊 Total users to add: ${userIds.length}\n`);
        
        let added = 0;
        let skipped = 0;
        let errors = 0;
        
        for (const userId of userIds) {
            try {
                // Проверяем существует ли пользователь
                const existingUser = await userService.getUser(userId);
                
                if (existingUser) {
                    console.log(`✓ User ${userId} already exists`);
                    skipped++;
                } else {
                    // Создаём пользователя
                    const userData = {
                        id: userId,
                        username: undefined,
                        first_name: 'User',
                        last_name: ''
                    };
                    
                    await userService.createUser(userData, 'manual_import');
                    
                    // Добавляем 1 бесплатную генерацию
                    await userService.addFreeQuota(userId, 1);
                    
                    console.log(`✅ Added user ${userId} with 1 free quota`);
                    added++;
                }
                
            } catch (err) {
                console.error(`❌ Error adding user ${userId}: ${err.message}`);
                errors++;
            }
        }
        
        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📊 Import Summary:');
        console.log(`✅ Added: ${added}`);
        console.log(`⚠️  Already existed: ${skipped}`);
        console.log(`❌ Errors: ${errors}`);
        console.log(`📝 Total: ${userIds.length}`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        
        process.exit(0);
    } catch (err) {
        console.error('❌ Fatal error:', err);
        process.exit(1);
    }
}

addUsers();
