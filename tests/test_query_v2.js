import 'dotenv/config';
import axios from 'axios';

const API_KEY = process.env.KIE_AI_API_KEY;
const taskId = '43857462c861b71f2ee04d3a7a1f9e3a';

async function testQuery() {
    console.log('Testing alternative query endpoints...\n');
    
    // Try POST method with taskId in body
    const endpoints = [
        { method: 'POST', url: 'https://api.kie.ai/api/v1/jobs/queryTask', data: { taskId } },
        { method: 'GET', url: `https://api.kie.ai/api/v1/tasks/${taskId}` },
        { method: 'GET', url: `https://api.kie.ai/api/v1/jobs/tasks/${taskId}` }
    ];
    
    for (const endpoint of endpoints) {
        console.log(`\nTrying ${endpoint.method}: ${endpoint.url}`);
        try {
            const config = {
                method: endpoint.method,
                url: endpoint.url,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${API_KEY}`
                }
            };
            if (endpoint.data) config.data = endpoint.data;
            
            const response = await axios(config);
            console.log('✅ Success!');
            console.log('Response:', JSON.stringify(response.data, null, 2));
            break;
        } catch (error) {
            console.log(`❌ ${error.response?.status || error.message}`);
            if (error.response?.data) {
                console.log('Error data:', JSON.stringify(error.response.data, null, 2));
            }
        }
    }
}

testQuery();
