#!/usr/bin/env node

/**
 * Скрипт для получения списка Offer ID из Lava
 */

import 'dotenv/config';
import axios from 'axios';

async function getLavaOffers() {
    try {
        const apiKey = process.env.LAVA_PAYMENT_API;
        
        if (!apiKey) {
            console.error('❌ LAVA_PAYMENT_API не найден в .env');
            process.exit(1);
        }
        
        console.log('🔍 Получаем список товаров из Lava...');
        console.log(`🔑 API Key: ${apiKey.substring(0, 20)}...`);
        console.log('');
        
        // Пробуем разные endpoints
        const endpoints = [
            '/api/v2/offers',
            '/api/v2/products',
            '/api/v2/shop/products',
            '/api/business/shop/get-list'
        ];
        
        for (const endpoint of endpoints) {
            try {
                console.log(`📡 Пробуем: https://gate.lava.top${endpoint}`);
                
                const response = await axios.get(
                    `https://gate.lava.top${endpoint}`,
                    {
                        headers: {
                            'X-Api-Key': apiKey
                        }
                    }
                );
                
                console.log('✅ Успешно!');
                console.log('📦 Ответ:', JSON.stringify(response.data, null, 2));
                console.log('');
                
                if (response.data && Array.isArray(response.data)) {
                    console.log('📋 Найденные товары:');
                    response.data.forEach((offer, index) => {
                        console.log(`${index + 1}. ${offer.name || offer.title}`);
                        console.log(`   ID: ${offer.id || offer.offerId}`);
                        console.log(`   Цена: ${offer.price || offer.amount} ${offer.currency || 'RUB'}`);
                        console.log('');
                    });
                }
                
                break;
            } catch (err) {
                if (err.response?.status === 404) {
                    console.log('❌ 404 - endpoint не найден');
                } else {
                    console.log(`❌ Ошибка: ${err.message}`);
                }
                console.log('');
            }
        }
        
    } catch (error) {
        console.error('❌ Ошибка:', error.message);
    } finally {
        process.exit(0);
    }
}

getLavaOffers();
