// Тест исправленного парсинга callback_data

const testCases = [
    'crypto_USDT_single',
    'crypto_USDT_pack_10',
    'crypto_USDC_pack_100',
    'crypto_TON_pack_300'
];

const oldRegex = /crypto_(\w+)_(.+)/;
const newRegex = /crypto_([A-Z]+)_(.+)/;

console.log('🧪 Сравнение старой и новой регулярки\n');
console.log('═══════════════════════════════════════════════\n');

testCases.forEach(testData => {
    console.log(`📝 Тест: ${testData}`);
    
    const oldMatch = testData.match(oldRegex);
    const newMatch = testData.match(newRegex);
    
    if (oldMatch) {
        console.log(`  ❌ Старая: crypto="${oldMatch[1]}", package="${oldMatch[2]}"`);
    }
    
    if (newMatch) {
        console.log(`  ✅ Новая: crypto="${newMatch[1]}", package="${newMatch[2]}"`);
    }
    
    console.log('');
});

console.log('═══════════════════════════════════════════════\n');
console.log('✅ Теперь crypto парсится правильно!');
