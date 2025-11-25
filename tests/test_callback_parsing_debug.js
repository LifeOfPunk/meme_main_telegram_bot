// Тест парсинга callback_data

const testCases = [
    'crypto_USDT_single',
    'crypto_USDT_pack_10',
    'crypto_USDC_pack_100',
    'crypto_TON_pack_300'
];

const regex = /crypto_(\w+)_(.+)/;

console.log('🧪 Тест парсинга callback_data для криптовалют\n');

testCases.forEach(testData => {
    const match = testData.match(regex);
    if (match) {
        const crypto = match[1];
        const packageKey = match[2];
        console.log(`✅ ${testData}`);
        console.log(`   crypto: "${crypto}"`);
        console.log(`   packageKey: "${packageKey}"\n`);
    } else {
        console.log(`❌ ${testData} - не совпадает!\n`);
    }
});

// Проверим что происходит с неправильным форматом
console.log('🔍 Проверка проблемных случаев:\n');

const problematicCases = [
    'crypto_USDT_pack_10',  // правильный
    'crypto_USDT_pack',     // неправильный (без номера)
];

problematicCases.forEach(testData => {
    const match = testData.match(regex);
    if (match) {
        console.log(`Callback: ${testData}`);
        console.log(`  match[0]: ${match[0]} (вся строка)`);
        console.log(`  match[1]: ${match[1]} (crypto)`);
        console.log(`  match[2]: ${match[2]} (packageKey)`);
        console.log('');
    }
});
