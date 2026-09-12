import assert from 'node:assert';
import { createMainMenuKeyboard, createProfileKeyboard } from '../src/screens/keyboards.js';
import { getMainMenuText, MESSAGES, PACKAGES } from '../src/config.js';
import { loadAllMemes, getMemeById } from '../src/utils/memeLoader.js';

console.log('🧪 Testing Prototype Integration Parity...\n');

// 1. Keyboard tests
console.log('1️⃣ Main Menu Keyboard Structure');
const kbNoFree = await createMainMenuKeyboard({ free_quota: 0 });
const rowsNoFree = kbNoFree.inline_keyboard;
assert.strictEqual(rowsNoFree[0][0].text, '🎬 Создать видео');
assert.strictEqual(rowsNoFree[0][0].callback_data, 'create_video');
assert.strictEqual(rowsNoFree[1][0].text, '💳 Пополнить баланс');
assert.strictEqual(rowsNoFree[1][0].callback_data, 'buy');
assert.strictEqual(rowsNoFree[2][0].text, '👤 Личный кабинет');
assert.strictEqual(rowsNoFree[2][0].callback_data, 'profile');
assert.strictEqual(rowsNoFree[3][0].text, '🤝 Реферальная программа');
assert.strictEqual(rowsNoFree[3][0].callback_data, 'referral');
console.log('   ✅ 4-row keyboard without free quota verified');

const kbWithFree = await createMainMenuKeyboard({ free_quota: 3 });
const rowsWithFree = kbWithFree.inline_keyboard;
assert.strictEqual(rowsWithFree[0][0].text, '🎬 Создать видео');
assert.strictEqual(rowsWithFree[1][0].text, '🎁 Бесплатная генерация');
assert.strictEqual(rowsWithFree[1][0].callback_data, 'create_video_free');
assert.strictEqual(rowsWithFree[2][0].text, '💳 Пополнить баланс');
assert.strictEqual(rowsWithFree[3][0].text, '👤 Личный кабинет');
assert.strictEqual(rowsWithFree[4][0].text, '🤝 Реферальная программа');
console.log('   ✅ 5-row keyboard with free quota verified');

// 2. Profile Keyboard tests
console.log('\n2️⃣ Profile Keyboard Structure');
const profileKbZero = createProfileKeyboard({ totalCashback: 0 });
const profileRowsZero = profileKbZero.inline_keyboard;
assert(!profileRowsZero.some(row => row.some(btn => btn.text.includes('Вывести'))), 'Should not show withdraw button if cashback is 0');
assert(profileRowsZero.some(row => row.some(btn => btn.text.includes('Инструкция'))), 'Should show instruction button in profile');
assert(profileRowsZero.some(row => row.some(btn => btn.text.includes('История транзакций'))), 'Should show transaction history in profile');

const profileKbWithCashback = createProfileKeyboard({ totalCashback: 15.5 });
const profileRowsWithCashback = profileKbWithCashback.inline_keyboard;
assert(profileRowsWithCashback.some(row => row.some(btn => btn.text.includes('Вывести'))), 'Should show withdraw button if cashback > 0');
console.log('   ✅ Profile keyboard withdrawal conditional display verified');

// 3. Main Menu Text
console.log('\n3️⃣ Main Menu Copy & Stats');
const userMock = {
    free_quota: 2,
    paid_quota: 8,
    wallet_balance: 5.50
};
const menuText = getMainMenuText(userMock);
assert(!menuText.includes('Всего генераций в системе'), 'Must not contain fake generation counter (TASK-20)');
assert(menuText.includes('📊 *Ваш баланс генераций:* 14 видео'));
assert(menuText.includes('🎬 *Стоимость генерации:* 1.30$'));
assert(menuText.includes('5.50 USDT'));
assert(!menuText.includes('Omni Flash'), 'Must not contain specific AI model names');
assert(!menuText.includes('Grok'), 'Must not contain Grok');
console.log('   ✅ Main menu text formatted correctly with video price and no AI model branding');

// 4. Profile copy
console.log('\n4️⃣ Profile Copy & Withdrawal');
const profileText = MESSAGES.PROFILE(
    { userId: 123456, firstName: 'Rick', free_quota: 5, paid_quota: 10, totalCashback: 25.00 },
    15,
    { referredUsers: 4, totalCashback: 25.00 }
);
assert(profileText.includes('🎬 Стоимость генерации: 1.30$'));
assert(profileText.includes('📊 Ваш баланс генераций: 15 видео'));
assert(profileText.includes('💰 Доступно к выводу: 25.00 USDT'));
assert(profileText.includes('👥 Приглашено друзей: 4'));
console.log('   ✅ Profile text has USDT balance, video cost and referral withdrawal');

// 5. Payment packages & Card confirmation
console.log('\n5️⃣ Packages & Card Payment Links');
assert(PACKAGES.pack_10.rub === 500);
assert(PACKAGES.pack_10.generations === 10);
const cardConfirmMsg = MESSAGES.PAYMENT_CARD_CONFIRM(PACKAGES.pack_10);
assert(cardConfirmMsg.includes('https://aiviral.agency/dogovor-oferta/'));
assert(cardConfirmMsg.includes('https://aiviral.agency/politika-konfidencialnosti/'));
console.log('   ✅ Payment packages & legal URLs verified');

// 6. Meme catalog & media metadata
console.log('\n6️⃣ Meme Catalog & Media Metadata');
const memes = loadAllMemes();
assert(memes.length >= 2);
for (const m of memes) {
    assert(m.media, `Meme ${m.id} must have media object`);
    assert(m.media.views_count > 0, `Meme ${m.id} must have positive views`);
    assert(m.media.video, `Meme ${m.id} must have video path`);
    assert(m.media.statistic, `Meme ${m.id} must have statistic image path`);
}
console.log('   ✅ Memes have valid media, virality stats, and preview paths');

console.log('\n🎉 ALL PROTOTYPE PARITY TESTS PASSED!');
process.exit(0);
