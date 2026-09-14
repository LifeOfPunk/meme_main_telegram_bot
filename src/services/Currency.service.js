import https from 'https';
import axios from 'axios';
import redis from '../redis.js';

const httpsAgent = new https.Agent({ family: 4 });

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
            const response = await axios.get('https://www.cbr-xml-daily.ru/daily_json.js', { httpsAgent, timeout: 5000 });
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

    // Получить курс криптовалюты к USDT с Binance с кешированием в Redis
    async getCryptoRate(symbol = 'TONUSDT') {
        const cleanSymbol = symbol.toUpperCase();
        const cacheKey = `binance_rate_${cleanSymbol}`;
        const cacheTtl = 10 * 60; // 10 минут кеша

        try {
            if (redis && redis.status === 'ready') {
                const cachedRate = await redis.get(cacheKey);
                if (cachedRate) {
                    const rate = parseFloat(cachedRate);
                    if (!isNaN(rate) && rate > 0) {
                        return rate;
                    }
                }
            }

            console.log(`📡 Fetching live rate for ${cleanSymbol} from Binance API...`);
            const response = await axios.get(`https://api.binance.com/api/v3/ticker/price?symbol=${cleanSymbol}`, {
                httpsAgent,
                timeout: 5000
            });

            if (response.data && response.data.price) {
                const rate = parseFloat(response.data.price);
                if (!isNaN(rate) && rate > 0) {
                    if (redis && redis.status === 'ready') {
                        await redis.set(cacheKey, rate.toString(), 'EX', cacheTtl);
                    }
                    console.log(`✅ Cached Binance live rate for ${cleanSymbol}: ${rate} USDT`);
                    return rate;
                }
            }
        } catch (err) {
            console.warn(`⚠️ Failed to fetch Binance rate for ${cleanSymbol}: ${err.message}`);
        }

        return null;
    }
}

export const currencyService = new CurrencyService();
