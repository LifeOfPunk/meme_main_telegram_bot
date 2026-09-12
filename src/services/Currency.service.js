import axios from 'axios';
import redis from '../redis.js';

export class CurrencyService {
    constructor() {
        this.cacheKey = 'cbr_usd_rub';
        this.cacheTtlSeconds = 12 * 60 * 60; // 12 часов
        this.defaultRate = 90.0;
    }

    // Получить курс USD ЦБ РФ
    async getUsdRate() {
        try {
            if (redis && redis.status === 'ready') {
                const cachedRate = await redis.get(this.cacheKey);
                if (cachedRate) {
                    const rate = parseFloat(cachedRate);
                    if (!isNaN(rate) && rate > 0) {
                        return rate;
                    }
                }
            }

            console.log('📡 Fetching official CBR USD rate from API...');
            const response = await axios.get('https://www.cbr-xml-daily.ru/daily_json.js', { timeout: 5000 });
            const valute = response.data?.Valute?.USD;
            if (valute && valute.Value) {
                const rate = parseFloat(valute.Value);
                if (redis && redis.status === 'ready') {
                    await redis.set(this.cacheKey, rate.toString(), 'EX', this.cacheTtlSeconds);
                }
                console.log(`✅ Cached CBR USD rate: ${rate} RUB`);
                return rate;
            }
        } catch (err) {
            console.warn(`⚠️ Failed to fetch CBR rate: ${err.message}, using fallback: ${this.defaultRate}`);
        }

        return this.defaultRate;
    }

    // Конвертировать рубли в доллары с округлением в меньшую сторону (до 1 знака: 500/90 = 5.5)
    async rubToUsdFloor(rubAmount) {
        const rate = await this.getUsdRate();
        const rawUsd = Number(rubAmount) / rate;
        // Округление в меньшую сторону до 1 десятичного знака
        const floored = Math.floor(rawUsd * 10) / 10;
        return {
            usd: Number(floored.toFixed(2)),
            rate: rate,
            rawUsd: rawUsd
        };
    }
}

export const currencyService = new CurrencyService();
