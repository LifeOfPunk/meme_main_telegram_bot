#!/usr/bin/env node
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const tests = [
    { name: 'User Service', file: 'test_user_service.js' },
    { name: 'Order Service', file: 'test_order_service.js' },
    { name: 'Referral Service', file: 'test_referral_service.js' },
    { name: 'Generation Service (Mock)', file: 'mock_generation.js' }
];

console.log('🚀 Запуск всех тестов MeeMee Bot\n');
console.log('='.repeat(60));

let passed = 0;
let failed = 0;

async function runTest(testName, testFile) {
    return new Promise((resolve) => {
        console.log(`\n📦 Тест: ${testName}`);
        console.log('-'.repeat(60));
        
        const testPath = join(__dirname, testFile);
        const process = spawn('node', [testPath], {
            stdio: 'inherit',
            shell: true
        });
        
        process.on('close', (code) => {
            if (code === 0) {
                passed++;
                console.log(`✅ ${testName} - ПРОЙДЕН`);
            } else {
                failed++;
                console.log(`❌ ${testName} - ПРОВАЛЕН (код: ${code})`);
            }
            resolve(code);
        });
    });
}

async function runAllTests() {
    for (const test of tests) {
        await runTest(test.name, test.file);
        // Пауза между тестами
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 ИТОГИ ТЕСТИРОВАНИЯ');
    console.log('='.repeat(60));
    console.log(`✅ Пройдено: ${passed}/${tests.length}`);
    console.log(`❌ Провалено: ${failed}/${tests.length}`);
    
    if (failed === 0) {
        console.log('\n🎉 ВСЕ ТЕСТЫ ПРОЙДЕНЫ УСПЕШНО!\n');
        console.log('Система полностью работоспособна.');
        console.log('Готова к запуску после настройки API ключей.\n');
    } else {
        console.log('\n⚠️  Некоторые тесты провалились.\n');
    }
}

runAllTests().catch(err => {
    console.error('❌ Ошибка запуска тестов:', err);
    process.exit(1);
});
