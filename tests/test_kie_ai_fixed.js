import 'dotenv/config';
import axios from 'axios';

const API_KEY = process.env.KIE_AI_API_KEY;
const API_URL = 'https://api.kie.ai/api/v1/jobs';

async function testKieAi() {
    console.log('🧪 Testing Kie.ai Sora 2 Integration (Fixed)...\n');
    
    if (!API_KEY) {
        console.error('❌ KIE_AI_API_KEY not found in .env file');
        return;
    }
    
    console.log('✅ API Key loaded:', API_KEY.substring(0, 10) + '...');
    
    try {
        console.log('\n📤 Creating video generation task...');
        
        const createResponse = await axios.post(
            `${API_URL}/createTask`,
            {
                model: 'sora-2-text-to-video',
                input: {
                    prompt: 'A cute cat playing with a ball of yarn in a sunny room.',
                    aspect_ratio: 'landscape',
                    n_frames: '10',
                    remove_watermark: true
                }
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${API_KEY}`
                }
            }
        );
        
        console.log('✅ Task created successfully!');
        console.log('Response:', JSON.stringify(createResponse.data, null, 2));
        
        if (createResponse.data && createResponse.data.code === 200 && createResponse.data.data) {
            const taskId = createResponse.data.data.taskId;
            console.log(`\n📝 Task ID: ${taskId}`);
            console.log('\n⏳ Polling for task status (this may take a while)...\n');
            
            // Poll for status using correct endpoint
            let attempts = 0;
            const maxAttempts = 60;
            const interval = 10000; // 10 seconds
            
            while (attempts < maxAttempts) {
                attempts++;
                
                try {
                    const statusResponse = await axios.get(
                        `${API_URL}/recordInfo`,
                        {
                            params: { taskId },
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${API_KEY}`
                            }
                        }
                    );
                    
                    if (statusResponse.data && statusResponse.data.code === 200 && statusResponse.data.data) {
                        const taskData = statusResponse.data.data;
                        console.log(`[${attempts}/${maxAttempts}] Status: ${taskData.state}`);
                        
                        if (taskData.state === 'success') {
                            console.log('\n✅ Video generation completed!');
                            
                            if (taskData.resultJson) {
                                const result = typeof taskData.resultJson === 'string' 
                                    ? JSON.parse(taskData.resultJson) 
                                    : taskData.resultJson;
                                
                                console.log('\n🎬 Video URL:', result.resultUrls[0]);
                                console.log('⏱️  Cost time:', Math.round((taskData.completeTime - taskData.createTime) / 1000), 'seconds');
                            }
                            break;
                        } else if (taskData.state === 'fail') {
                            console.error('\n❌ Video generation failed!');
                            console.error('Error:', taskData.failMsg);
                            break;
                        }
                    }
                    
                    // Wait before next attempt
                    await new Promise(resolve => setTimeout(resolve, interval));
                    
                } catch (pollError) {
                    console.error(`Polling error: ${pollError.message}`);
                    if (attempts === maxAttempts) {
                        throw pollError;
                    }
                    await new Promise(resolve => setTimeout(resolve, interval));
                }
            }
            
            if (attempts >= maxAttempts) {
                console.error('\n⏰ Timeout: Video generation took too long');
            }
        }
        
    } catch (error) {
        console.error('\n❌ Error:', error.message);
        if (error.response) {
            console.error('API Response:', JSON.stringify(error.response.data, null, 2));
        }
    }
}

testKieAi();
