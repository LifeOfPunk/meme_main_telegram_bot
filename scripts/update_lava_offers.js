import 'dotenv/config';
import axios from 'axios';
import fs from 'fs';
import path from 'path';

const LAVA_API_KEY = process.env.LAVA_PAYMENT_API;
const LAVA_BASE_URL = 'https://api.lava.ru';

async function getLavaOffers() {
    try {
        console.log('🔍 Получаем список офферов из Lava API...\n');
        
        const response = await axios.get(`${LAVA_BASE_URL}/business/shop/get-available-tariffs`, {
            headers: {
                'Authorization': LAVA_API_KEY,
                'Content-Type': 'application/json'
            }
        });

        console.log('📦 Полный ответ API:');
        console.log(JSON.stringify(response.data, null, 2));
        console.log('');

        // Пробуем разные варианты структуры ответа
        let offers = response.data.data || response.data.tariffs || response.data;
        
        if (!offers || !Array.isArray(offers)) {
            console.error('❌ Неверный формат ответа от API');
            console.error('Ожидался массив, получено:', typeof offers);
            return null;
        }
        console.log(`✅ Найдено ${offers.length} офферов:\n`);

        // Группируем по суммам
        const offersByAmount = {};
        
        offers.forEach((offer, index) => {
            const amount = offer.sum || offer.amount;
            console.log(`${index + 1}. ID: ${offer.tariff_id || offer.id}`);
            console.log(`   Название: ${offer.name || 'N/A'}`);
            console.log(`   Сумма: ${amount}₽`);
            console.log(`   Описание: ${offer.description || 'N/A'}`);
            console.log('');

            if (!offersByAmount[amount]) {
                offersByAmount[amount] = [];
            }
            offersByAmount[amount].push(offer);
        });

        return { offers, offersByAmount };
    } catch (error) {
        console.error('❌ Ошибка при получении офферов:');
        console.error(`Статус: ${error.response?.status}`);
        console.error(`Сообщение: ${error.response?.data?.message || error.message}`);
        console.error(`URL: ${error.config?.url}`);
        return null;
    }
}

async function updateConfigFile(offersByAmount) {
    try {
        console.log('\n📝 Обновляем config.js...\n');

        const configPath = path.join(process.cwd(), 'src', 'config.js');
        let configContent = fs.readFileSync(configPath, 'utf8');

        // Читаем текущие пакеты из конфига
        const packagesMatch = configContent.match(/export const PACKAGES = \{[\s\S]*?\n\};/);
        if (!packagesMatch) {
            console.error('❌ Не удалось найти PACKAGES в config.js');
            return false;
        }

        // Маппинг сумм к пакетам
        const packageMapping = {
            '99': 'single',
            '249': 'pack_3',
            '449': 'pack_5',
            '799': 'pack_10'
        };

        const updates = [];

        for (const [amount, packageKey] of Object.entries(packageMapping)) {
            const offers = offersByAmount[amount];
            if (offers && offers.length > 0) {
                const offerId = offers[0].tariff_id || offers[0].id;
                
                // Ищем и заменяем lavaOfferId для этого пакета
                const regex = new RegExp(
                    `(${packageKey}:\\s*\\{[^}]*lavaOfferId:\\s*['"])([^'"]*)(["'][^}]*\\})`,
                    'g'
                );

                const oldMatch = configContent.match(regex);
                const oldOfferId = oldMatch ? oldMatch[0].match(/lavaOfferId:\s*['"]([^'"]*)['"]/)?.[1] : 'не найден';

                configContent = configContent.replace(regex, `$1${offerId}$3`);
                
                updates.push({
                    package: packageKey,
                    amount: amount,
                    oldOfferId: oldOfferId,
                    newOfferId: offerId
                });

                console.log(`✅ ${packageKey} (${amount}₽): ${oldOfferId} → ${offerId}`);
            } else {
                console.log(`⚠️  ${packageKey} (${amount}₽): оффер не найден в API`);
            }
        }

        // Сохраняем обновленный конфиг
        fs.writeFileSync(configPath, configContent, 'utf8');
        
        console.log('\n✅ Файл config.js успешно обновлен!');
        console.log('\n📋 Сводка изменений:');
        console.table(updates);

        return true;
    } catch (error) {
        console.error('❌ Ошибка при обновлении config.js:', error.message);
        return false;
    }
}

async function main() {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔄 Обновление Lava Offer IDs');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    if (!LAVA_API_KEY) {
        console.error('❌ LAVA_PAYMENT_API не найден в .env файле');
        process.exit(1);
    }

    const result = await getLavaOffers();
    
    if (!result) {
        console.error('\n❌ Не удалось получить офферы из API');
        process.exit(1);
    }

    const { offersByAmount } = result;

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const updated = await updateConfigFile(offersByAmount);

    if (updated) {
        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('✅ Готово! Теперь перезапусти бота:');
        console.log('   pm2 restart meemee-bot');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    } else {
        console.log('\n❌ Обновление не выполнено');
        process.exit(1);
    }
}

main();
