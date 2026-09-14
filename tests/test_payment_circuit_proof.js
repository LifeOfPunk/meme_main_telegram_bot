import 'dotenv/config';
import { PaymentCryptoService } from '../src/services/PaymentCrypto.service.js';
import { PaymentFiatService } from '../src/services/PaymentFiat.service.js';
import { PACKAGES, SUPPORTED_CRYPTO } from '../src/config.js';
import { createPaymentCryptoKeyboard } from '../src/screens/keyboards.js';

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🧪 VERIFYING PAYMENT CIRCUIT (TASK-02-03, TASK-04-05, TASK-15)');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

async function verifyAll() {
    let allPassed = true;

    // 1. Проверка 4 пакетов Lava
    console.log('📦 1. Проверка пакетов Lava:');
    const expectedPacks = [
        { key: 'pack_10', rub: 500, generations: 10 },
        { key: 'pack_50', rub: 2250, generations: 50 },
        { key: 'pack_100', rub: 4250, generations: 100 },
        { key: 'pack_500', rub: 20000, generations: 500 }
    ];

    for (const exp of expectedPacks) {
        const pkg = PACKAGES[exp.key];
        if (pkg && pkg.rub === exp.rub && pkg.generations === exp.generations && pkg.offerIdLava) {
            console.log(`  ✅ ${exp.key}: ${pkg.rub}₽ (${pkg.generations} видео), offerId=${pkg.offerIdLava.substring(0, 8)}...`);
        } else {
            console.error(`  ❌ Mismatch in package ${exp.key}`);
            allPassed = false;
        }
    }

    // 2. Проверка 4 сетей 0xProcessing
    console.log('\n💎 2. Проверка 4 сетей крипто-платежей (1 шаг):');
    const expectedNetworks = [
        { id: 'TON', name: '💎 TON (Gram)', processing: 'TON' },
        { id: 'USDT_BEP20', name: '⚡ USDT (BEP20)', processing: 'USDT (BEP20)' },
        { id: 'USDT_SOL', name: '🟣 USDT (SOL)', processing: 'USDT (SOL)' },
        { id: 'BNB_BEP20', name: '🟡 BNB (BEP20)', processing: 'BNB' }
    ];

    for (const exp of expectedNetworks) {
        const found = SUPPORTED_CRYPTO.find(c => c.id === exp.id);
        if (found && found.name === exp.name && found.processing === exp.processing) {
            console.log(`  ✅ ${found.name} -> processing code: "${found.processing}"`);
        } else {
            console.error(`  ❌ Network mismatch for ${exp.id}: found=${JSON.stringify(found)}`);
            allPassed = false;
        }
    }

    // 3. Проверка клавиатуры крипто-пополнения
    console.log('\n⌨️ 3. Проверка инлайн-клавиатуры крипто-пополнения:');
    const dummyAddr = 'EQAFF6Tf_jAATTaj-hs1ireZOvfdP7bL8x4fHWmM32wvP-G5';
    const kb = createPaymentCryptoKeyboard('TEST-ORDER-123', 'deposit', dummyAddr, null);
    const btns = kb.inline_keyboard;
    console.log(`  Кнопки (${btns.length}):`);
    btns.forEach((row, i) => {
        const b = row[0];
        console.log(`    ${i + 1}. [${b.text}] ${b.copy_text ? `(copy_text: ${b.copy_text.text.substring(0, 10)}...)` : b.callback_data ? `(callback: ${b.callback_data})` : `(url: ${b.url})`}`);
    });

    if (btns[0][0].text === '📋 Скопировать адрес' && btns[0][0].copy_text?.text === dummyAddr) {
        console.log('  ✅ Кнопка [📋 Скопировать адрес] настроена с native copy_text');
    } else {
        console.error('  ❌ Кнопка скопировать адрес не соответствует спецификации');
        allPassed = false;
    }

    if (btns[1][0].text === '✅ Проверить оплату' && btns[1][0].callback_data === 'check_payment_TEST-ORDER-123') {
        console.log('  ✅ Кнопка [✅ Проверить оплату] настроена корректно');
    } else {
        console.error('  ❌ Кнопка проверить оплату не соответствует спецификации');
        allPassed = false;
    }

    if (btns[2][0].text === '🔙 Назад' && btns[2][0].callback_data === 'buy') {
        console.log('  ✅ Кнопка [🔙 Назад] настроена корректно');
    } else {
        console.error('  ❌ Кнопка назад не соответствует спецификации');
        allPassed = false;
    }

    // 4. Проверка создания крипто-депозита через 0xProcessing (Live Gateway)
    console.log('\n🚀 4. Боевое тестирование 0xProcessing (депозит 0.50 USDT):');
    const cryptoService = new PaymentCryptoService();
    for (const net of expectedNetworks) {
        try {
            const res = await cryptoService.createPayment({
                userId: 999000111,
                amount: 0.50,
                payCurrency: net.name.includes('BNB') ? 'BNB (BEP20)' : net.processing,
                package: 'deposit'
            });

            if (res.error) {
                console.error(`  ❌ ${net.name} failed: ${res.error}`);
                allPassed = false;
            } else {
                const addr = res.output?.address;
                const hasQR = !!res.output?.qrCode;
                const isNot404 = !res.output?.paymentUrl || !res.output.paymentUrl.includes('/payment/1');
                console.log(`  ✅ ${net.name} -> Address: ${addr?.substring(0, 12)}... | QR: ${hasQR ? 'OK' : 'NO'} | No-404: ${isNot404 ? 'OK' : 'FAIL'}`);
            }
        } catch (e) {
            console.error(`  ❌ ${net.name} exception: ${e.message}`);
            allPassed = false;
        }
    }

    // 5. Проверка 1-Click создания инвойса Lava
    console.log('\n🚀 5. Боевое тестирование Lava (1-Click инвойс pack_10 500₽):');
    const fiatService = new PaymentFiatService();
    try {
        const testUserId = 888777666;
        const res = await fiatService.createPayment({
            userId: testUserId,
            email: `user${testUserId}@viralapp.bot`,
            amount: 500,
            bank: 'BANK131',
            package: 'pack_10'
        });

        if (res.error) {
            console.error(`  ❌ Lava failed: ${res.error}`);
            allPassed = false;
        } else {
            console.log(`  ✅ Lava invoice: ID=${res.output?.id} | URL=${res.output?.paymentUrl ? 'OK (Valid URL)' : 'NO'}`);
        }
    } catch (e) {
        console.error(`  ❌ Lava exception: ${e.message}`);
        allPassed = false;
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    if (allPassed) {
        console.log('🎉 ALL PAYMENT CIRCUIT TESTS PASSED SUCCESSFULLY!');
        process.exit(0);
    } else {
        console.error('❌ SOME TESTS FAILED');
        process.exit(1);
    }
}

verifyAll();
