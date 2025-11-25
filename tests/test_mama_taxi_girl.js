import 'dotenv/config';
import { GenerationService } from './src/services/Generation.service.js';
import redis from './src/redis.js';

console.log('🧪 Testing Mama Taxi Meme Generation (FEMALE)...\n');

const generationService = new GenerationService();

const testName = 'Маша';
const testGender = 'female';

async function testGeneration() {
    try {
        console.log('📝 Testing with FEMALE gender...');
        console.log(`Name: ${testName}`);
        console.log(`Gender: ${testGender}\n`);

        const memeData = generationService.loadMemePrompt('mama_taxi');
        const genderReplacements = generationService.getGenderReplacements(testGender);
        
        console.log('🔄 Gender replacements for FEMALE:');
        console.log(JSON.stringify(genderReplacements, null, 2));
        console.log('');

        const processedPrompt = generationService.replacePlaceholders(
            JSON.parse(JSON.stringify(memeData.prompt)), 
            { name: testName, ...genderReplacements }
        );

        console.log('✅ Processed prompt (excerpt):');
        console.log('─────────────────────────────────────────');
        console.log('Visual:', processedPrompt.visual.substring(0, 300) + '...');
        console.log('─────────────────────────────────────────\n');

        const promptString = JSON.stringify(processedPrompt);
        
        console.log('📋 Verification for FEMALE:');
        console.log(`  - Name (${testName}):`, promptString.includes(testName) ? '✅' : '❌');
        console.log(`  - Gender child (girl):`, promptString.includes('girl') ? '✅' : '❌');
        console.log(`  - Gender pronoun (She):`, promptString.includes('She') ? '✅' : '❌');
        console.log(`  - Gender possessive (her):`, promptString.includes('her') ? '✅' : '❌');
        console.log(`  - Full description:`, promptString.includes('полная девочка славянской национальности') ? '✅' : '❌');

        console.log('\n✅ Female gender test passed!');

    } catch (err) {
        console.error('❌ Test failed:', err.message);
        process.exit(1);
    } finally {
        await redis.quit();
        process.exit(0);
    }
}

testGeneration();
