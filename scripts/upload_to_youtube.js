import { YouTubeService } from '../src/services/YouTube.service.js';
import { GenerationService } from '../src/services/Generation.service.js';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const generationId = process.argv[2];

if (!generationId) {
    console.error('❌ Usage: node upload_to_youtube.js <generation_id>');
    process.exit(1);
}

async function downloadVideo(url, filepath) {
    const writer = fs.createWriteStream(filepath);
    const response = await axios({
        url,
        method: 'GET',
        responseType: 'stream'
    });
    
    response.data.pipe(writer);
    
    return new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
    });
}

async function main() {
    try {
        console.log('');
        console.log('═══════════════════════════════════════════════════════');
        console.log('📤 Upload Video to YouTube');
        console.log('═══════════════════════════════════════════════════════');
        console.log('');
        
        const generationService = new GenerationService();
        const youtubeService = new YouTubeService();
        
        // Получаем информацию о генерации
        console.log(`🔍 Loading generation: ${generationId}`);
        const generation = await generationService.getGeneration(generationId);
        
        if (!generation) {
            console.error('❌ Generation not found');
            process.exit(1);
        }
        
        if (generation.status !== 'done') {
            console.error(`❌ Generation status: ${generation.status} (must be 'done')`);
            process.exit(1);
        }
        
        if (!generation.videoUrl) {
            console.error('❌ Video URL not found');
            process.exit(1);
        }
        
        console.log('✅ Generation found');
        console.log(`   Meme: ${generation.memeName}`);
        console.log(`   Name: ${generation.name}`);
        console.log(`   Gender: ${generation.gender}`);
        console.log('');
        
        // Скачиваем видео
        const tempDir = path.join(__dirname, '..', 'temp');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }
        
        const videoPath = path.join(tempDir, `${generationId}.mp4`);
        
        console.log('⬇️ Downloading video...');
        await downloadVideo(generation.videoUrl, videoPath);
        console.log('✅ Video downloaded');
        console.log('');
        
        // Загружаем на YouTube
        const metadata = {
            title: `${generation.memeName} - ${generation.name}`,
            description: `Мем с ${generation.name}!\n\n🤖 Создай свой мем: @meemee_bot\n🎬 Мем: ${generation.memeName}`,
            tags: ['мем', 'видео', 'meemee', generation.memeName.toLowerCase()],
            categoryId: process.env.YOUTUBE_CATEGORY || '23',
            privacyStatus: process.env.YOUTUBE_PRIVACY || 'public'
        };
        
        console.log('📤 Uploading to YouTube...');
        console.log(`   Title: ${metadata.title}`);
        console.log(`   Privacy: ${metadata.privacyStatus}`);
        console.log('');
        
        const result = await youtubeService.uploadVideo(videoPath, metadata);
        
        if (result.error) {
            console.error('❌ Upload failed:', result.error);
            process.exit(1);
        }
        
        console.log('✅ Upload successful!');
        console.log('');
        console.log('═══════════════════════════════════════════════════════');
        console.log('📺 Video Info:');
        console.log('═══════════════════════════════════════════════════════');
        console.log(`   Video ID: ${result.videoId}`);
        console.log(`   URL: ${result.videoUrl}`);
        console.log('');
        
        // Сохраняем ссылку на YouTube в генерации
        await generationService.updateGeneration(generationId, {
            youtubeUrl: result.videoUrl,
            youtubeVideoId: result.videoId
        });
        
        // Удаляем временный файл
        fs.unlinkSync(videoPath);
        console.log('🗑️ Temporary file deleted');
        console.log('');
        
    } catch (error) {
        console.error('');
        console.error('❌ Error:', error.message);
        console.error('');
        process.exit(1);
    }
}

main();
