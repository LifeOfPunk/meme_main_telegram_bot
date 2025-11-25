import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Загрузка всех мемов
export function loadAllMemes() {
    const memesDir = path.join(__dirname, '../memes');
    const memeFiles = fs.readdirSync(memesDir).filter(file => file.endsWith('.json'));
    
    const memes = [];
    for (const file of memeFiles) {
        try {
            const memePath = path.join(memesDir, file);
            const memeData = JSON.parse(fs.readFileSync(memePath, 'utf8'));
            memes.push(memeData);
        } catch (err) {
            console.error(`Error loading meme ${file}:`, err.message);
        }
    }
    
    return memes;
}

// Загрузка активных мемов
export function loadActiveMemes() {
    const allMemes = loadAllMemes();
    return allMemes.filter(meme => meme.status === 'active' || meme.status === 'soon');
}

// Получение мема по ID
export function getMemeById(memeId) {
    const allMemes = loadAllMemes();
    return allMemes.find(meme => meme.id === memeId);
}
