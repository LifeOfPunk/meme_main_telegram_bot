#!/usr/bin/env node

/**
 * Скрипт для прямой пометки заказа как оплаченного в базе данных
 * Использование: node test_mark_paid.js <orderId>
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Загружаем .env вручную
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envPath = join(__dirname, '.env');

try {
    const envFile = readFileSync(envPath, 'utf8');
    envFile.split('\n').forEach(line => {
        const match = line.match(/^([^=:#]+)=(.*)$/);
        if (match) {
            const key = match[1].trim();
            const value = match[2].trim().replace(/^["']|["']$/g, '');
            process.env[key] = value;
        }
    });
} catch (err) {
    console.warn('⚠️ Could not load .env file:', err.message);
}

import { OrderService } from './src/services/Order.service.js';
import { UserService } from './src/services/User.service.js';

const orderId = process.argv[2];

if (!orderId) {
    console.error('❌ Ошибка: Не указан orderId');
    console.log('\nИспользование:');
    console.log('  node test_mark_paid.js <orderId>');
    console.log('\nПример:');
    console.log('  node test_mark_paid.js CRYPTO-20251120-1234567890');
    process.exit(1);
}

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🧪 Пометка заказа как оплаченного');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`📝 Order ID: ${orderId}\n`);

const orderService = new OrderService();
const userService = new UserService();

try {
    // Получаем заказ
    console.log('🔍 Поиск заказа...');
    const order = await orderService.getOrderById(orderId);
    
    if (!order) {
        console.error(`❌ Заказ ${orderId} не найден!`);
        process.exit(1);
    }
    
    console.log('✅ Заказ найден:');
    console.log(`   User ID: ${order.userId}`);
    console.log(`   Package: ${order.package}`);
    console.log(`   Amount: ${order.amount}`);
    console.log(`   Currency: ${order.currency}`);
    console.log(`   Is Paid: ${order.isPaid}`);
    
    if (order.isPaid) {
        console.log('\n⚠️ Заказ уже оплачен!');
        process.exit(0);
    }
    
    // Помечаем как оплаченный
    console.log('\n💰 Помечаем заказ как оплаченный...');
    await orderService.markOrderAsPaid(orderId);
    console.log('✅ Заказ помечен как оплаченный');
    
    // Добавляем генерации пользователю
    console.log('\n🎁 Добавляем генерации пользователю...');
    
    // Получаем количество генераций из конфига пакета
    const PACKAGES = {
        'basic': { generations: 10 },
        'standard': { generations: 50 },
        'premium': { generations: 150 },
        'ultimate': { generations: 500 }
    };
    
    const generations = PACKAGES[order.package]?.generations || 10;
    
    await userService.addGenerations(order.userId, generations);
    console.log(`✅ Добавлено ${generations} генераций пользователю ${order.userId}`);
    
    // Проверяем баланс
    const user = await userService.getUser(order.userId);
    console.log(`💎 Текущий баланс: ${user.generations} генераций`);
    
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ Оплата симулирована успешно!');
    console.log('💡 Пользователь должен получить уведомление в боте');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    process.exit(0);
    
} catch (error) {
    console.error('\n❌ Ошибка:', error.message);
    console.error(error.stack);
    process.exit(1);
}
