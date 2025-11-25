import 'dotenv/config';
import { errorLogger } from './src/services/ErrorLogger.service.js';

async function clearAllErrors() {
    try {
        console.log('🗑️ Очистка всех ошибок...');
        
        await errorLogger.clearAllErrors();
        
        console.log('✅ Все ошибки успешно очищены!');
        console.log('');
        console.log('Функционал логирования ошибок продолжит работать.');
        console.log('Новые ошибки будут записываться в систему.');
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Ошибка при очистке:', error);
        process.exit(1);
    }
}

clearAllErrors();
