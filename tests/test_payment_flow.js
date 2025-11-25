#!/usr/bin/env node

/**
 * Тест полного flow создания платежа
 */

import { PACKAGES, SUPPORTED_CRYPTO } from './src/config.js';

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🧪 Тест flow создания платежа');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

// 1. Проверяем пакеты
console.log('📦 Доступные пакеты:');
Object.entries(PACKAGES).forEach(([key, pkg]) => {
    console.log(`  ${key}: ${pkg.title} - $${pkg.usdt} (${pkg.generations} генераций)`);
});

// 2. Проверяем криптовалюты
console.log('\n💎 Поддерживаемые криптовалюты:');
Object.entries(SUPPORTED_CRYPTO).forEach(([crypto, chains]) => {
    console.log(`\n  ${crypto}:`);
    chains.forEach(chain => {
        console.log(`    - ${chain.name}`);
        console.log(`      processing: "${chain.processing}"`);
        
        // Симулируем создание callback_data
        const callbackData = `chain_${crypto}_${chain.processing.replace(/\s+/g, '_')}_pack_10`;
        console.log(`      callback: ${callbackData}`);
        
        // Симулируем НОВЫЙ парсинг (как в исправленном коде)
        const parts = callbackData.split('_');
        let packageKey = null;
        let chainParts = [];
        
        // Идем с конца и собираем packageKey
        for (let i = parts.length - 1; i >= 2; i--) {
            if (parts[i].match(/^(single|pack|10|50|100|500)$/)) {
                if (parts[i] === 'pack' && parts[i + 1]) {
                    packageKey = `pack_${parts[i + 1]}`;
                    chainParts = parts.slice(2, i);
                    break;
                }
            }
        }
        
        if (!packageKey) {
            packageKey = parts[parts.length - 1];
            chainParts = parts.slice(2, -1);
        }
        
        const chainStr = chainParts.join('_');
        const payCurrency = chainStr.replace(/_/g, ' ');
        
        console.log(`      parsed chain: "${chainStr}"`);
        console.log(`      parsed package: "${packageKey}"`);
        console.log(`      payCurrency: "${payCurrency}"`);
        console.log(`      match: ${payCurrency === chain.processing ? '✅' : '❌'}`);
    });
});

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('✅ Тест завершен');
