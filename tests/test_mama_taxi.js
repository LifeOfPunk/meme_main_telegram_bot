import 'dotenv/config';
import { GenerationService } from './src/services/Generation.service.js';
import redis from './src/redis.js';

console.log('🧪 Testing Mama Taxi Meme Generation...\n');

const generationService = new GenerationService();

// Тестовые данные
const testUserId = 888888888;
const testName = 'Ростик';
const testGender = 'male';
const testMemeId = 'mama_taxi';

async function testGeneration() {
    try {
        console.log('📝 Testing meme generation...');
        console.log(`User ID: ${testUserId}`);
        console.log(`Name: ${testName}`);
        console.log(`Gender: ${testGender}`);
        console.log(`Meme ID: ${testMemeId}\n`);

        // Загружаем данные мема
        const memeData = generationService.loadMemePrompt(testMemeId);
        if (!memeData) {
            console.error('❌ Meme not found!');
            process.exit(1);
        }

        console.log('✅ Meme data loaded successfully\n');
        console.log('📦 Original meme structure:');
        console.log('─────────────────────────────────────────');
        console.log(JSON.stringify(memeData, null, 2));
        console.log('─────────────────────────────────────────\n');

        // Получаем замены для гендера
        const genderReplacements = generationService.getGenderReplacements(testGender);
        
        console.log('🔄 Gender replacements:');
        console.log(JSON.stringify(genderReplacements, null, 2));
        console.log('');

        // Обрабатываем промпт
        let processedPrompt;
        if (typeof memeData.prompt === 'string') {
            processedPrompt = memeData.prompt
                .replace('{name}', testName)
                .replace('{gender}', testGender)
                .replace('{gender_text}', genderReplacements.gender_text);
        } else {
            processedPrompt = generationService.replacePlaceholders(
                JSON.parse(JSON.stringify(memeData.prompt)), 
                { name: testName, ...genderReplacements }
            );
        }

        console.log('✅ Processed prompt:');
        console.log('─────────────────────────────────────────');
        console.log(JSON.stringify(processedPrompt, null, 2));
        console.log('─────────────────────────────────────────\n');

        // Проверяем, что все плейсхолдеры заменены
        const promptString = JSON.stringify(processedPrompt);
        const remainingPlaceholders = promptString.match(/\{[a-z_]+\}/g);
        
        if (remainingPlaceholders) {
            console.error('❌ ERROR: Some placeholders were not replaced!');
            console.error('Remaining placeholders:', remainingPlaceholders);
            process.exit(1);
        }

        console.log('✅ All placeholders replaced successfully!');
        console.log('✅ Name appears in prompt:', promptString.includes(testName));
        console.log('✅ Duration is 8s:', memeData.duration === 8);
        
        // Проверяем специфические замены
        console.log('\n📋 Verification:');
        console.log(`  - Name (${testName}):`, promptString.includes(testName) ? '✅' : '❌');
        console.log(`  - Gender child (boy):`, promptString.includes('boy') ? '✅' : '❌');
        console.log(`  - Gender pronoun (He):`, promptString.includes('He') ? '✅' : '❌');
        console.log(`  - Gender possessive (his):`, promptString.includes('his') ? '✅' : '❌');
        console.log(`  - Full description:`, promptString.includes('полный мальчик славянской национальности') ? '✅' : '❌');

        console.log('\n✅ Test passed! Meme is ready for generation.');

    } catch (err) {
        console.error('❌ Test failed:', err.message);
        console.error(err);
        process.exit(1);
    } finally {
        await redis.quit();
        console.log('\n✅ Test completed');
        process.exit(0);
    }
}

// Запуск теста
testGeneration();
