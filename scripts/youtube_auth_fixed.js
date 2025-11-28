import 'dotenv/config';
import { google } from 'googleapis';
import http from 'http';
import { parse } from 'url';

const CLIENT_ID = process.env.YOUTUBE_CLIENT_ID;
const CLIENT_SECRET = process.env.YOUTUBE_CLIENT_SECRET;
const REDIRECT_URI = 'http://localhost:3000/oauth2callback';

if (!CLIENT_ID || !CLIENT_SECRET) {
    console.error('❌ Please set YOUTUBE_CLIENT_ID and YOUTUBE_CLIENT_SECRET in .env');
    process.exit(1);
}

const oauth2Client = new google.auth.OAuth2(
    CLIENT_ID,
    CLIENT_SECRET,
    REDIRECT_URI
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
console.log('Открываю браузер для авторизации...');
console.log('');
console.log('Если браузер не открылся, перейдите по ссылке:');
console.log(authUrl);
console.log('');
console.log('Ожидаю авторизации...');
console.log('');

// Создаем локальный сервер для получения кода
const server = http.createServer(async (req, res) => {
    try {
        const queryData = parse(req.url, true).query;
        
        if (queryData.code) {
            const code = queryData.code;
            
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(`
                <html>
                <head>
                    <meta charset="utf-8">
                    <title>Авторизация успешна</title>
                    <style>
                        body { font-family: Arial; text-align: center; padding: 50px; background: #f0f0f0; }
                        .success { background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); max-width: 500px; margin: 0 auto; }
                        h1 { color: #4CAF50; }
                    </style>
                </head>
                <body>
                    <div class="success">
                        <h1>✅ Авторизация успешна!</h1>
                        <p>Можете закрыть это окно и вернуться в терминал.</p>
                    </div>
                </body>
                </html>
            `);
            
            // Получаем токены
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
            
            try {
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
                console.log('⚠️  Не удалось получить информацию о канале:', error.message);
            }
            
            server.close();
            process.exit(0);
            
        } else if (queryData.error) {
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(`
                <html>
                <head>
                    <meta charset="utf-8">
                    <title>Ошибка авторизации</title>
                    <style>
                        body { font-family: Arial; text-align: center; padding: 50px; background: #f0f0f0; }
                        .error { background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); max-width: 500px; margin: 0 auto; }
                        h1 { color: #f44336; }
                    </style>
                </head>
                <body>
                    <div class="error">
                        <h1>❌ Ошибка авторизации</h1>
                        <p>${queryData.error}</p>
                        <p>Можете закрыть это окно и попробовать снова.</p>
                    </div>
                </body>
                </html>
            `);
            
            console.error('');
            console.error('❌ Ошибка авторизации:', queryData.error);
            console.error('');
            
            server.close();
            process.exit(1);
        }
    } catch (error) {
        console.error('');
        console.error('❌ Ошибка:', error.message);
        console.error('');
        
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Internal Server Error');
        
        server.close();
        process.exit(1);
    }
});

server.listen(3000, () => {
    console.log('🌐 Сервер запущен на http://localhost:3000');
    console.log('');
    console.log('Скопируйте и откройте эту ссылку в браузере:');
    console.log('');
    console.log(authUrl);
    console.log('');
});

// Таймаут на 5 минут
setTimeout(() => {
    console.error('');
    console.error('❌ Таймаут авторизации (5 минут)');
    console.error('');
    server.close();
    process.exit(1);
}, 5 * 60 * 1000);
