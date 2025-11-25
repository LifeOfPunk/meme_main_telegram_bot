import { google } from 'googleapis';
import readline from 'readline';

const CLIENT_ID = process.env.YOUTUBE_CLIENT_ID;
const CLIENT_SECRET = process.env.YOUTUBE_CLIENT_SECRET;

if (!CLIENT_ID || !CLIENT_SECRET) {
    console.error('❌ Please set YOUTUBE_CLIENT_ID and YOUTUBE_CLIENT_SECRET in .env');
    process.exit(1);
}

const oauth2Client = new google.auth.OAuth2(
    CLIENT_ID,
    CLIENT_SECRET,
    'urn:ietf:wg:oauth:2.0:oob'
);

const scopes = [
    'https://www.googleapis.com/auth/youtube.upload',
    'https://www.googleapis.com/auth/youtube',
    'https://www.googleapis.com/auth/youtube.force-ssl'
];

const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    prompt: 'consent'
});

console.log('');
console.log('═══════════════════════════════════════════════════════');
console.log('🔐 YouTube API Authorization');
console.log('═══════════════════════════════════════════════════════');
console.log('');
console.log('1. Откройте эту ссылку в браузере:');
console.log('');
console.log(authUrl);
console.log('');
console.log('2. Разрешите доступ к YouTube каналу');
console.log('3. Скопируйте код авторизации');
console.log('');
console.log('═══════════════════════════════════════════════════════');
console.log('');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

rl.question('Введите код авторизации: ', async (code) => {
    try {
        const { tokens } = await oauth2Client.getToken(code);
        
        console.log('');
        console.log('✅ Авторизация успешна!');
        console.log('');
        console.log('═══════════════════════════════════════════════════════');
        console.log('📝 Добавьте в .env:');
        console.log('═══════════════════════════════════════════════════════');
        console.log('');
        console.log(`YOUTUBE_REFRESH_TOKEN=${tokens.refresh_token}`);
        console.log('');
        console.log('═══════════════════════════════════════════════════════');
        console.log('');
        
        // Проверяем доступ к каналу
        oauth2Client.setCredentials(tokens);
        const youtube = google.youtube({ version: 'v3', auth: oauth2Client });
        
        const response = await youtube.channels.list({
            part: ['snippet', 'statistics'],
            mine: true
        });
        
        if (response.data.items && response.data.items.length > 0) {
            const channel = response.data.items[0];
            console.log('📺 Информация о канале:');
            console.log(`   Название: ${channel.snippet.title}`);
            console.log(`   ID: ${channel.id}`);
            console.log(`   Подписчики: ${channel.statistics.subscriberCount}`);
            console.log(`   Видео: ${channel.statistics.videoCount}`);
            console.log('');
        }
        
    } catch (error) {
        console.error('');
        console.error('❌ Ошибка авторизации:', error.message);
        console.error('');
    }
    
    rl.close();
});
