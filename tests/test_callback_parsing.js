// Тест парсинга callback_data для разных пакетов

const testCases = [
    // Single package
    { data: 'chain_USDT_USDT_(TRC20)_single', expected: { crypto: 'USDT', chain: 'USDT_(TRC20)', packageKey: 'single' } },
    { data: 'chain_USDT_USDT_(ERC20)_single', expected: { crypto: 'USDT', chain: 'USDT_(ERC20)', packageKey: 'single' } },
    { data: 'chain_TON_TON_single', expected: { crypto: 'TON', chain: 'TON', packageKey: 'single' } },
    
    // pack_10
    { data: 'chain_USDT_USDT_(TRC20)_pack_10', expected: { crypto: 'USDT', chain: 'USDT_(TRC20)', packageKey: 'pack_10' } },
    { data: 'chain_USDT_USDT_(ERC20)_pack_10', expected: { crypto: 'USDT', chain: 'USDT_(ERC20)', packageKey: 'pack_10' } },
    { data: 'chain_TON_TON_pack_10', expected: { crypto: 'TON', chain: 'TON', packageKey: 'pack_10' } },
    
    // pack_100
    { data: 'chain_USDC_USDC_(POLYGON)_pack_100', expected: { crypto: 'USDC', chain: 'USDC_(POLYGON)', packageKey: 'pack_100' } },
    
    // pack_300
    { data: 'chain_USDT_USDT_(ARB1)_pack_300', expected: { crypto: 'USDT', chain: 'USDT_(ARB1)', packageKey: 'pack_300' } },
];

function parseCallbackData(data) {
    const parts = data.split('_');
    
    if (parts.length < 4) {
        return { error: 'Invalid format' };
    }
    
    const crypto = parts[1];
    
    let packageKey = '';
    let chainParts = [];
    
    for (let i = parts.length - 1; i >= 2; i--) {
        if (parts[i].match(/^(single|pack|10|100|300)$/)) {
            if (parts[i] === 'pack' && parts[i + 1]) {
                packageKey = `pack_${parts[i + 1]}`;
                chainParts = parts.slice(2, i);
                break;
            } else if (parts[i] === 'single') {
                packageKey = 'single';
                chainParts = parts.slice(2, i);
                break;
            }
        }
    }
    
    if (!packageKey) {
        packageKey = parts[parts.length - 1];
        chainParts = parts.slice(2, -1);
    }
    
    const chain = chainParts.join('_');
    
    return { crypto, chain, packageKey };
}

console.log('🧪 Testing callback_data parsing...\n');

let passed = 0;
let failed = 0;

testCases.forEach((test, idx) => {
    const result = parseCallbackData(test.data);
    const isMatch = 
        result.crypto === test.expected.crypto &&
        result.chain === test.expected.chain &&
        result.packageKey === test.expected.packageKey;
    
    if (isMatch) {
        console.log(`✅ Test ${idx + 1}: PASSED`);
        console.log(`   Input: ${test.data}`);
        console.log(`   Result: ${JSON.stringify(result)}`);
        passed++;
    } else {
        console.log(`❌ Test ${idx + 1}: FAILED`);
        console.log(`   Input: ${test.data}`);
        console.log(`   Expected: ${JSON.stringify(test.expected)}`);
        console.log(`   Got: ${JSON.stringify(result)}`);
        failed++;
    }
    console.log('');
});

console.log(`\n📊 Results: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
