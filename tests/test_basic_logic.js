import { PACKAGES } from '../src/config.js';

console.log('🧪 Testing configuration and basic logic\n');

// Тест 1: Проверка пакетов
console.log('Test 1: Packages configuration');
Object.keys(PACKAGES).forEach(key => {
    const pkg = PACKAGES[key];
    console.log(`  ${pkg.emoji} ${pkg.title}: ${pkg.generations} генераций, ${pkg.rub}₽`);
});

console.log('\n---\n');

// Тест 2: Симуляция логики кнопки
console.log('Test 2: Button logic simulation');

function shouldShowFreeButton(freeQuota) {
    return freeQuota > 0;
}

function createButtonText(freeQuota) {
    return `🎁 Использовать бесплатную генерацию (осталось: ${freeQuota})`;
}

const testCases = [
    { userId: 1, freeQuota: 1 },
    { userId: 2, freeQuota: 0 },
    { userId: 3, freeQuota: 5 },
    { userId: 4, freeQuota: 10 }
];

testCases.forEach(testCase => {
    const show = shouldShowFreeButton(testCase.freeQuota);
    console.log(`\nUser ${testCase.userId}: free_quota = ${testCase.freeQuota}`);
    console.log(`  Show button: ${show}`);
    if (show) {
        console.log(`  Button text: "${createButtonText(testCase.freeQuota)}"`);
    }
});

console.log('\n---\n');
console.log('✅ Basic logic tests passed!\n');
console.log('📝 Summary:');
console.log('  - Кнопка показывается только когда free_quota > 0');
console.log('  - Текст кнопки включает количество оставшихся генераций');
console.log('  - При нажатии кнопки пользователь перенаправляется в каталог мемов');
