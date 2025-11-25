#!/usr/bin/env node

import axios from 'axios';

const currencies = ['USDT (SOL)', 'USDC (SOL)'];

console.log('🔍 Проверка поддержки Solana в 0xprocessing\n');

for (const currency of currencies) {
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`📊 ${currency}`);
    
    try {
        const response = await axios.get(
            `https://app.0xprocessing.com/Api/CoinInfo/${currency}`,
            { timeout: 10000 }
        );
        
        console.log('✅ Поддерживается!');
        console.log(JSON.stringify(response.data, null, 2));
        
        if (response.data) {
            const { min, max, active, minimumWithdrawFee } = response.data;
            console.log('\n📋 Информация:');
            if (min) console.log(`  Минимум: ${min}`);
            if (max) console.log(`  Максимум: ${max}`);
            if (minimumWithdrawFee) console.log(`  Комиссия вывода: ${minimumWithdrawFee}`);
            if (active !== undefined) console.log(`  Активна: ${active ? 'Да' : 'Нет'}`);
        }
        
    } catch (err) {
        console.log('❌ Не поддерживается или ошибка:', err.message);
        if (err.response) {
            console.log('Status:', err.response.status);
        }
    }
    
    console.log('');
}

console.log('✅ Проверка завершена');
