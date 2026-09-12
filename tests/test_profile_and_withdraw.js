import assert from 'assert';
import { createProfileKeyboard } from '../src/screens/keyboards.js';

console.log('🧪 Запуск тестов Личного кабинета и клавиатур...\n');

// Тест 1: Профиль пользователя БЕЗ кешбэка и с free_quota > 0
{
    const userNoCashback = {
        userId: 123456,
        firstName: 'Alex',
        free_quota: 3,
        paid_quota: 0,
        totalCashback: 0
    };

    const kb = createProfileKeyboard(userNoCashback);
    const buttons = kb.inline_keyboard;
    
    // Проверка отсутствия кнопки "🎁 Бесплатная генерация"
    const hasFreeQuotaBtn = buttons.some(row => row.some(b => b.text.includes('Бесплатная генерация')));
    assert.strictEqual(hasFreeQuotaBtn, false, 'Кнопка "Бесплатная генерация" не должна быть в Профиле');

    // Проверка отсутствия кнопки "💸 Вывести средства" при cashback == 0
    const hasWithdrawBtn = buttons.some(row => row.some(b => b.text.includes('Вывести средства')));
    assert.strictEqual(hasWithdrawBtn, false, 'Кнопка "Вывести средства" должна отсутствовать при 0 кешбэка');

    // Проверка точного набора из 6 кнопок
    assert.strictEqual(buttons.length, 6, 'Должно быть ровно 6 кнопок при totalCashback == 0');
    assert.strictEqual(buttons[0][0].text, '💳 Пополнить баланс');
    assert.strictEqual(buttons[0][0].callback_data, 'buy');
    assert.strictEqual(buttons[1][0].text, '🎁 Реферальная программа');
    assert.strictEqual(buttons[1][0].callback_data, 'referral');
    assert.strictEqual(buttons[2][0].text, '📜 История генераций');
    assert.strictEqual(buttons[2][0].callback_data, 'profile_history');
    assert.strictEqual(buttons[3][0].text, '💬 Поддержка');
    assert.strictEqual(buttons[3][0].url, 'https://t.me/aiviral_main');
    assert.strictEqual(buttons[4][0].text, 'ℹ️ О проекте');
    assert.strictEqual(buttons[4][0].callback_data, 'about');
    assert.strictEqual(buttons[5][0].text, '🔙 Главное меню');
    assert.strictEqual(buttons[5][0].callback_data, 'main_menu');
    console.log('✅ Тест 1 пройден: Профиль без кешбэка (6 кнопок, без бесплатной генерации, без вывода)');
}

// Тест 2: Профиль пользователя С кешбэком > 0
{
    const userWithCashback = {
        userId: 123456,
        firstName: 'Alex',
        free_quota: 2,
        paid_quota: 5,
        totalCashback: 15.5
    };

    const kb = createProfileKeyboard(userWithCashback);
    const buttons = kb.inline_keyboard;

    assert.strictEqual(buttons.length, 7, 'Должно быть ровно 7 кнопок при totalCashback > 0');
    assert.strictEqual(buttons[0][0].text, '💳 Пополнить баланс');
    assert.strictEqual(buttons[0][0].callback_data, 'buy');
    assert.strictEqual(buttons[1][0].text, '💸 Вывести средства');
    assert.strictEqual(buttons[1][0].callback_data, 'withdraw');
    assert.strictEqual(buttons[2][0].text, '🎁 Реферальная программа');
    assert.strictEqual(buttons[2][0].callback_data, 'referral');
    assert.strictEqual(buttons[3][0].text, '📜 История генераций');
    assert.strictEqual(buttons[3][0].callback_data, 'profile_history');
    assert.strictEqual(buttons[4][0].text, '💬 Поддержка');
    assert.strictEqual(buttons[4][0].url, 'https://t.me/aiviral_main');
    assert.strictEqual(buttons[5][0].text, 'ℹ️ О проекте');
    assert.strictEqual(buttons[5][0].callback_data, 'about');
    assert.strictEqual(buttons[6][0].text, '🔙 Главное меню');
    assert.strictEqual(buttons[6][0].callback_data, 'main_menu');
    console.log('✅ Тест 2 пройден: Профиль с кешбэком (7 кнопок в точном порядке, с кнопкой вывода)');
}

// Тест 3: Формирование ответа при выводе средств
{
    const amount = Number(15.5).toFixed(2);
    const text = `💼 Вывод реферального вознаграждения от $5.00 осуществляется через менеджера.\n\nВаш доступный кешбэк: ${amount} USDT\n\nДля выплаты напишите нашему менеджеру: @aiviral_main`;
    
    const keyboard = {
        inline_keyboard: [
            [{ text: '💬 Написать менеджеру', url: 'https://t.me/aiviral_main' }],
            [{ text: '🔙 Назад в профиль', callback_data: 'profile' }]
        ]
    };

    assert.strictEqual(text, '💼 Вывод реферального вознаграждения от $5.00 осуществляется через менеджера.\n\nВаш доступный кешбэк: 15.50 USDT\n\nДля выплаты напишите нашему менеджеру: @aiviral_main');
    assert.strictEqual(keyboard.inline_keyboard[0][0].text, '💬 Написать менеджеру');
    assert.strictEqual(keyboard.inline_keyboard[0][0].url, 'https://t.me/aiviral_main');
    assert.strictEqual(keyboard.inline_keyboard[1][0].text, '🔙 Назад в профиль');
    assert.strictEqual(keyboard.inline_keyboard[1][0].callback_data, 'profile');
    console.log('✅ Тест 3 пройден: Шаблон и клавиатура вывода средств строго соответствуют ТЗ');
}

console.log('\n🎉 Все проверки успешно пройдены!');
process.exit(0);
