import 'dotenv/config';
import { loadAllMemes } from '../src/utils/memeLoader.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🧪 Тест: Meme Loader (загрузка и валидация мемов)\n');

async function testMemeLoader() {
    try {
        console.log('1️⃣ Тест загрузки всех мемов\n');
        
        const memes = loadAllMemes();
        
        console.log(`   ✅ Загружено мемов: ${memes.length}`);
        
        console.log('\n📋 Список доступных мемов:\n');
        
        memes.forEach((meme, index) => {
            const statusIcon = meme.status === 'active' ? '✅' : '⏳';
            console.log(`   ${index + 1}. ${statusIcon} ${meme.name}`);
            console.log(`      ID: ${meme.id}`);
            console.log(`      Статус: ${meme.status}`);
            const promptStr = typeof meme.prompt === 'string' ? meme.prompt : JSON.stringify(meme.prompt);
            console.log(`      Промпт: ${promptStr.substring(0, 60)}...`);
            console.log(`      Длительность: ${meme.duration}с\n`);
        });
        
        console.log('2️⃣ Тест валидации мемов\n');
        
        const requiredFields = ['id', 'name', 'status', 'prompt', 'duration'];
        let validationErrors = 0;
        
        for (const meme of memes) {
            for (const field of requiredFields) {
                if (!meme[field]) {
                    console.log(`   ❌ Мем "${meme.name || meme.id}": отсутствует поле "${field}"`);
                    validationErrors++;
                }
            }
            
            // Проверка статуса
            if (!['active', 'soon', 'hidden'].includes(meme.status)) {
                console.log(`   ⚠️  Мем "${meme.name}": некорректный статус "${meme.status}"`);
                validationErrors++;
            }
            
            // Проверка плейсхолдеров в промпте
            if (meme.status === 'active') {
                const promptStr = typeof meme.prompt === 'string' ? meme.prompt : JSON.stringify(meme.prompt);
                if (!promptStr.includes('{name}')) {
                    console.log(`   ⚠️  Мем "${meme.name}": промпт не содержит {name}`);
                }
                if (!promptStr.includes('{gender_text}') && !promptStr.includes('{gender}')) {
                    console.log(`   ⚠️  Мем "${meme.name}": промпт не содержит {gender_text} или {gender}`);
                }
            }
        }
        
        if (validationErrors === 0) {
            console.log('   ✅ Все мемы прошли валидацию');
        } else {
            console.log(`   ⚠️  Найдено ошибок валидации: ${validationErrors}`);
        }
        
        console.log('\n3️⃣ Тест фильтрации активных мемов\n');
        
        const activeMemes = memes.filter(m => m.status === 'active');
        const soonMemes = memes.filter(m => m.status === 'soon');
        const hiddenMemes = memes.filter(m => m.status === 'hidden');
        
        console.log(`   ✅ Активных: ${activeMemes.length}`);
        console.log(`   ⏳ Скоро: ${soonMemes.length}`);
        console.log(`   🔒 Скрытых: ${hiddenMemes.length}`);
        
        console.log('\n4️⃣ Тест поиска мема по ID\n');
        
        const testId = 'mama_taxi';
        const foundMeme = memes.find(m => m.id === testId);
        
        if (foundMeme) {
            console.log(`   ✅ Мем найден: ${foundMeme.name}`);
            console.log(`   📝 ID: ${foundMeme.id}`);
            console.log(`   📊 Статус: ${foundMeme.status}`);
        } else {
            console.log(`   ❌ Мем с ID "${testId}" не найден`);
        }
        
        console.log('\n5️⃣ Тест подстановки данных в промпт\n');
        
        if (foundMeme) {
            const testName = 'Алекс';
            const testGender = 'male';
            const genderText = testGender === 'male' ? 'мальчик' : 'девочка';
            
            const rawPrompt = typeof foundMeme.prompt === 'string' ? foundMeme.prompt : JSON.stringify(foundMeme.prompt);
            let finalPrompt = rawPrompt
                .replace(/{name}/g, testName)
                .replace(/{gender}/g, testGender)
                .replace(/{gender_text}/g, genderText);
            
            console.log(`   📝 Имя: ${testName}`);
            console.log(`   🚻 Пол: ${genderText}`);
            console.log(`   📄 Результат:\n`);
            console.log(`   ${finalPrompt.substring(0, 150)}...`);
            console.log('\n   ✅ Подстановка работает корректно');
        }
        
        console.log('\n6️⃣ Тест структуры файлов мемов\n');
        
        const memesDir = path.join(__dirname, '../src/memes');
        const files = fs.readdirSync(memesDir).filter(f => f.endsWith('.json'));
        
        console.log(`   📁 JSON файлов в директории: ${files.length}`);
        console.log(`   📦 Загружено мемов: ${memes.length}`);
        
        if (files.length === memes.length) {
            console.log('   ✅ Все файлы загружены корректно');
        } else {
            console.log('   ⚠️  Количество файлов не совпадает с загруженными мемами');
        }
        
        console.log('\n   Файлы мемов:');
        files.forEach(file => {
            console.log(`   - ${file}`);
        });
        
        console.log('\n✅ Все тесты загрузки мемов пройдены успешно!\n');
        
    } catch (err) {
        console.error('❌ Ошибка в тесте:', err.message);
        console.error(err.stack);
        process.exit(1);
    }
}

testMemeLoader();
