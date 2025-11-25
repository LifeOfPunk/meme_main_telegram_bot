import redis from '../redis.js';

export class ErrorLoggerService {
    constructor() {
        this.maxErrors = 100; // Максимум ошибок в Redis
    }

    // Логирование ошибки
    async logError(error) {
        try {
            const errorData = {
                id: this.generateId(),
                message: error.message || error,
                stack: error.stack || '',
                type: error.name || 'Error',
                timestamp: new Date().toISOString(),
                source: error.source || 'unknown'
            };

            // Сохраняем ошибку
            await redis.set(`error:${errorData.id}`, JSON.stringify(errorData));
            
            // Добавляем в список (сначала новые)
            await redis.lpush('error_list', errorData.id);
            
            // Ограничиваем количество ошибок
            await redis.ltrim('error_list', 0, this.maxErrors - 1);

            console.log(`🔴 Error logged: ${errorData.id} - ${errorData.message}`);
            
            return errorData;
        } catch (err) {
            console.error('❌ Failed to log error:', err);
        }
    }

    // Получение всех ошибок
    async getAllErrors(limit = 50) {
        try {
            const errorIds = await redis.lrange('error_list', 0, limit - 1);
            const errors = [];

            for (const id of errorIds) {
                const errorData = await redis.get(`error:${id}`);
                if (errorData) {
                    errors.push(JSON.parse(errorData));
                }
            }

            return errors;
        } catch (err) {
            console.error('❌ Error getting errors:', err);
            return [];
        }
    }

    // Получение ошибки по ID
    async getError(errorId) {
        try {
            const errorData = await redis.get(`error:${errorId}`);
            return errorData ? JSON.parse(errorData) : null;
        } catch (err) {
            console.error('❌ Error getting error:', err);
            return null;
        }
    }

    // Очистка всех ошибок
    async clearAllErrors() {
        try {
            const errorIds = await redis.lrange('error_list', 0, -1);
            
            for (const id of errorIds) {
                await redis.del(`error:${id}`);
            }
            
            await redis.del('error_list');
            
            console.log('✅ All errors cleared');
            return true;
        } catch (err) {
            console.error('❌ Error clearing errors:', err);
            return false;
        }
    }

    // Получение статистики ошибок
    async getErrorStats() {
        try {
            const errorIds = await redis.lrange('error_list', 0, -1);
            const errors = [];

            for (const id of errorIds) {
                const errorData = await redis.get(`error:${id}`);
                if (errorData) {
                    errors.push(JSON.parse(errorData));
                }
            }

            const now = new Date();
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

            const stats = {
                total: errors.length,
                today: errors.filter(e => new Date(e.timestamp) >= today).length,
                week: errors.filter(e => new Date(e.timestamp) >= weekAgo).length,
                byType: {}
            };

            // Группируем по типу
            errors.forEach(error => {
                const type = error.type || 'Unknown';
                stats.byType[type] = (stats.byType[type] || 0) + 1;
            });

            return stats;
        } catch (err) {
            console.error('❌ Error getting error stats:', err);
            return { total: 0, today: 0, week: 0, byType: {} };
        }
    }

    // Генерация ID
    generateId() {
        const timestamp = Date.now();
        const random = Math.floor(Math.random() * 10000);
        return `ERR-${timestamp}-${random}`;
    }
}

// Экспортируем singleton instance
export const errorLogger = new ErrorLoggerService();
