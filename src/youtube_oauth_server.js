import 'dotenv/config';
import express from 'express';
import { Telegraf } from 'telegraf';
import { YouTubeAuthService } from './services/YouTubeAuth.service.js';

const app = express();
const bot = new Telegraf(process.env.BOT_TOKEN);
const authService = new YouTubeAuthService();

// OAuth callback endpoint
app.get('/youtube-oauth', async (req, res) => {
  try {
    const { code, state, error } = req.query;

    if (error) {
      console.error('❌ OAuth error:', error);
      res.send(`
        <html>
          <head>
            <meta charset="utf-8">
            <title>Ошибка авторизации</title>
            <style>
              body { font-family: Arial; text-align: center; padding: 50px; background: #f0f0f0; }
              .error { background: white; padding: 30px; border-radius: 10px; max-width: 500px; margin: 0 auto; }
              h1 { color: #f44336; }
            </style>
          </head>
          <body>
            <div class="error">
              <h1>❌ Ошибка авторизации</h1>
              <p>${error}</p>
              <p>Вернитесь в бот и попробуйте снова.</p>
            </div>
          </body>
        </html>
      `);
      return;
    }

    if (!code || !state) {
      res.status(400).send('Missing code or state');
      return;
    }

    const userId = parseInt(state);

    // Обмениваем код на токены
    const result = await authService.exchangeCodeForTokens(code);

    if (!result.success) {
      console.error('❌ Failed to exchange code:', result.error);
      res.send(`
        <html>
          <head>
            <meta charset="utf-8">
            <title>Ошибка</title>
            <style>
              body { font-family: Arial; text-align: center; padding: 50px; background: #f0f0f0; }
              .error { background: white; padding: 30px; border-radius: 10px; max-width: 500px; margin: 0 auto; }
              h1 { color: #f44336; }
            </style>
          </head>
          <body>
            <div class="error">
              <h1>❌ Ошибка</h1>
              <p>Не удалось получить токены доступа.</p>
              <p>Вернитесь в бот и попробуйте снова.</p>
            </div>
          </body>
        </html>
      `);
      return;
    }

    // Сохраняем токены
    await authService.saveUserTokens(userId, result.tokens);

    // Получаем информацию о канале
    const channelInfo = await authService.getUserChannelInfo(userId);

    // Отправляем уведомление в бот
    try {
      await bot.telegram.sendMessage(
        userId,
        `✅ YouTube канал успешно подключен!\n\n` +
          `📺 Канал: ${channelInfo ? channelInfo.title : 'Неизвестно'}\n\n` +
          `Теперь вы можете загружать видео на свой канал!`,
        {
          reply_markup: {
            inline_keyboard: [[{ text: '🏠 Главное меню', callback_data: 'main_menu' }]],
          },
        }
      );
    } catch (notifyErr) {
      console.error('❌ Failed to notify user:', notifyErr.message);
    }

    // Показываем страницу успеха
    res.send(`
      <html>
        <head>
          <meta charset="utf-8">
          <title>Успешно!</title>
          <style>
            body { font-family: Arial; text-align: center; padding: 50px; background: #f0f0f0; }
            .success { background: white; padding: 30px; border-radius: 10px; max-width: 500px; margin: 0 auto; }
            h1 { color: #4CAF50; }
          </style>
        </head>
        <body>
          <div class="success">
            <h1>✅ Успешно!</h1>
            <p>YouTube канал подключен!</p>
            ${channelInfo ? `<p>📺 <strong>${channelInfo.title}</strong></p>` : ''}
            <p>Можете закрыть это окно и вернуться в бот.</p>
          </div>
        </body>
      </html>
    `);
  } catch (error) {
    console.error('❌ OAuth callback error:', error);
    res.status(500).send('Internal server error');
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

const PORT = process.env.YOUTUBE_OAUTH_PORT || 3001;

app.listen(PORT, () => {
  console.log(`🌐 YouTube OAuth server running on port ${PORT}`);
  console.log(`📍 Callback URL: ${process.env.WEBHOOK_DOMAIN || 'https://api.aiviral-agency.com'}/youtube-oauth`);
});
