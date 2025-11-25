import 'dotenv/config';
import axios from 'axios';

const API_KEY = process.env.KIE_AI_API_KEY;
const taskId = '43857462c861b71f2ee04d3a7a1f9e3a';

async function testQuery() {
    console.log('Testing query endpoint...\n');
    
    // Try different endpoint formats
    const endpoints = [
        `https://api.kie.ai/api/v1/jobs/queryTask?taskId=${taskId}`,
        `https://api.kie.ai/api/v1/jobs/task/${taskId}`,
        `https://api.kie.ai/api/v1/jobs/${taskId}`
    ];
    
    for (const endpoint of endpoints) {
        console.log(`\nTrying: ${endpoint}`);
        try {
            const response = await axios.get(endpoint, {
                headers: {
                    'Authorization': `Bearer ${API_KEY}`
                }
            });
            console.log('✅ Success!');
            console.log('Response:', JSON.stringify(response.data, null, 2));
            break;
        } catch (error) {
            console.log(`❌ ${error.response?.status || error.message}`);
        }
    }
}

testQuery();
