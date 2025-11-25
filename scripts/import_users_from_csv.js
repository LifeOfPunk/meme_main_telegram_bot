import 'dotenv/config';
import fs from 'fs';
import { UserService } from './src/services/User.service.js';

const userService = new UserService();

// Простой парсер CSV без внешних библиотек
function parseCSV(content) {
    const lines = content.split('\n').filter(line => line.trim());
    const headers = lines[0].split(',');
    const records = [];
    
    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',');
        const record = {};
        headers.forEach((header, index) => {
            record[header.trim()] = values[index] ? values[index].trim().replace(/^"|"$/g, '') : '';
        });
        records.push(record);
    }
    
    return records;
}

async function importUsers() {
    try {
        console.log('📥 Starting user import from CSV...\n');
        
        // Читаем CSV файл
        const csvContent = fs.readFileSync('./export_all.csv', 'utf-8');
        const records = parseCSV(csvContent);
        
        console.log(`📊 Found ${records.length} records in CSV\n`);
        
        let imported = 0;
        let skipped = 0;
        let errors = 0;
        
        for (const record of records) {
            try {
                let userId = null;
                let username = null;
                
                // Парсим username или id
                if (record.username.startsWith('@')) {
                    username = record.username.substring(1); // Убираем @
                } else if (record.username.startsWith('id:')) {
                    userId = parseInt(record.username.replace('id:', ''));
                }
                
                // Если есть username, пытаемся получить userId через Telegram API
                if (username && !userId) {
                    try {
                        console.log(`🔍 Looking up @${username}...`);
                        // Telegram API не позволяет получить userId по username напрямую
                        // Пропускаем такие записи
                        console.log(`⚠️  Skipped @${username} (need user ID)`);
                        skipped++;
                        continue;
                    } catch (err) {
                        console.log(`⚠️  Could not find @${username}`);
                        skipped++;
                        continue;
                    }
                }
                
                if (!userId) {
                    console.log(`⚠️  Skipped ${record.username} (no user ID)`);
                    skipped++;
                    continue;
                }
                
                // Проверяем существует ли пользователь
                const existingUser = await userService.getUser(userId);
                
                if (existingUser) {
                    console.log(`✓ User ${userId} (@${username || 'unknown'}) already exists`);
                    skipped++;
                } else {
                    // Создаём пользователя
                    const userData = {
                        id: userId,
                        username: username || undefined,
                        first_name: record.video_generate_name || 'User',
                        last_name: ''
                    };
                    
                    await userService.createUser(userData, record.utm_source);
                    
                    // Добавляем 1 бесплатную генерацию
                    await userService.addFreeQuota(userId, 1);
                    
                    console.log(`✅ Imported user ${userId} (@${username || 'unknown'}) with 1 free quota`);
                    imported++;
                }
                
            } catch (err) {
                console.error(`❌ Error processing record:`, record);
                console.error(`   Error: ${err.message}`);
                errors++;
            }
        }
        
        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📊 Import Summary:');
        console.log(`✅ Imported: ${imported}`);
        console.log(`⚠️  Skipped: ${skipped}`);
        console.log(`❌ Errors: ${errors}`);
        console.log(`📝 Total: ${records.length}`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        
        process.exit(0);
    } catch (err) {
        console.error('❌ Fatal error:', err);
        process.exit(1);
    }
}

importUsers();
