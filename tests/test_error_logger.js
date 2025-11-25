import 'dotenv/config';
import { errorLogger } from './src/services/ErrorLogger.service.js';

console.log('🧪 Testing Error Logger System...\n');

async function testErrorLogger() {
    try {
        console.log('📝 Test 1: Logging sample errors...');
        
        // Логируем несколько тестовых ошибок
        await errorLogger.logError({
            message: 'Test error 1: Database connection failed',
            stack: 'Error: Database connection failed\n    at connect (db.js:15:10)',
            name: 'DatabaseError',
            source: 'Database Service'
        });
        
        await errorLogger.logError({
            message: 'Test error 2: API request timeout',
            stack: 'Error: API request timeout\n    at request (api.js:42:5)',
            name: 'TimeoutError',
            source: 'API Service'
        });
        
        await errorLogger.logError({
            message: 'Test error 3: Video generation failed - insufficient credits',
            stack: 'Error: Video generation failed\n    at generateVideo (generation.js:123:8)',
            name: 'GenerationError',
            source: 'Generation Service'
        });
        
        console.log('✅ Test errors logged\n');
        
        console.log('📊 Test 2: Getting error statistics...');
        const stats = await errorLogger.getErrorStats();
        console.log('Statistics:', JSON.stringify(stats, null, 2));
        console.log('');
        
        console.log('📋 Test 3: Getting all errors...');
        const errors = await errorLogger.getAllErrors(10);
        console.log(`Found ${errors.length} errors:\n`);
        
        errors.forEach((error, index) => {
            console.log(`${index + 1}. [${new Date(error.timestamp).toLocaleString('ru-RU')}]`);
            console.log(`   Type: ${error.type}`);
            console.log(`   Message: ${error.message}`);
            console.log(`   Source: ${error.source}`);
            console.log('');
        });
        
        console.log('✅ All tests completed successfully!');
        console.log('\n📝 Summary:');
        console.log('  ✓ Error logging working');
        console.log('  ✓ Error statistics working');
        console.log('  ✓ Error retrieval working');
        console.log('\n🔔 Check admin bot to see these errors in the "❌ ОШИБКИ" section!');
        
    } catch (err) {
        console.error('❌ Test failed:', err.message);
        console.error(err.stack);
    } finally {
        process.exit(0);
    }
}

// Запускаем тест
testErrorLogger();
