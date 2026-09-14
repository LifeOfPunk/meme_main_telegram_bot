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
    const { code, state, error, error_description } = req.query;

    if (error) {
      console.error('❌ Google OAuth callback received error:', {
        error,
        error_description,
        query: req.query,
        timestamp: new Date().toISOString()
      });

      let explanation = 'Произошла ошибка при авторизации Google.';
      if (error === 'access_denied') {
        explanation = 'Вы отклонили доступ к YouTube каналу. Чтобы загружать видео из бота, необходимо подтвердить разрешения.';
      } else if (error === 'redirect_uri_mismatch') {
        explanation = `Ошибка конфигурации: redirect_uri не совпадает с настройками в Google Cloud Console (${authService.redirectUri}).`;
      } else if (error === 'invalid_request') {
        explanation = 'Некорректный запрос авторизации Google (возможно, ссылка устарела). Попробуйте получить новую ссылку в боте.';
      }

      res.status(400).send(`
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <title>Ошибка авторизации Google</title>
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; text-align: center; padding: 40px 20px; background: #f8f9fa; color: #333; }
              .card { background: white; padding: 32px; border-radius: 12px; max-width: 520px; margin: 0 auto; box-shadow: 0 4px 16px rgba(0,0,0,0.08); }
              h1 { color: #dc3545; margin-bottom: 16px; font-size: 24px; }
              p { line-height: 1.6; margin: 12px 0; color: #555; }
              .error-code { background: #ffeef0; color: #b02a37; padding: 6px 12px; border-radius: 6px; font-family: monospace; display: inline-block; margin: 10px 0; }
              .btn { display: inline-block; margin-top: 20px; padding: 12px 24px; background: #0088cc; color: white; text-decoration: none; border-radius: 8px; font-weight: 500; }
            </style>
          </head>
          <body>
            <div class="card">
              <h1>❌ Ошибка авторизации</h1>
              <div class="error-code">${error}</div>
              <p>${explanation}</p>
              ${error_description ? `<p><small style="color:#888;">${error_description}</small></p>` : ''}
              <p>Вернитесь в бот и попробуйте подключить канал снова.</p>
            </div>
          </body>
        </html>
      `);
      return;
    }

    if (!code || !state) {
      console.warn('⚠️ OAuth callback missing code or state parameter:', { query: req.query });
      res.status(400).send(`
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <title>Параметры отсутствуют</title>
            <style>
              body { font-family: sans-serif; text-align: center; padding: 40px; background: #f8f9fa; }
              .card { background: white; padding: 30px; border-radius: 10px; max-width: 480px; margin: 0 auto; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
              h1 { color: #e65100; font-size: 22px; }
            </style>
          </head>
          <body>
            <div class="card">
              <h1>⚠️ Некорректный запрос</h1>
              <p>Отсутствует код авторизации (code) или идентификатор сессии (state).</p>
              <p>Пожалуйста, начните авторизацию заново через бота.</p>
            </div>
          </body>
        </html>
      `);
      return;
    }

    const userId = parseInt(state);

    // Обмениваем код на токены
    const result = await authService.exchangeCodeForTokens(code);

    if (!result.success) {
      console.error('❌ Failed to exchange code for tokens:', {
        userId,
        error: result.error,
        errorCode: result.errorCode,
        details: result.details
      });

      res.status(400).send(`
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <title>Ошибка получения токенов</title>
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; text-align: center; padding: 40px 20px; background: #f8f9fa; }
              .card { background: white; padding: 32px; border-radius: 12px; max-width: 520px; margin: 0 auto; box-shadow: 0 4px 16px rgba(0,0,0,0.08); }
              h1 { color: #dc3545; font-size: 24px; }
              p { line-height: 1.6; color: #555; }
            </style>
          </head>
          <body>
            <div class="card">
              <h1>❌ Ошибка обмена токенов</h1>
              <p>${result.error || 'Не удалось получить токены доступа Google.'}</p>
              <p>Попробуйте повторить процедуру подключения в боте.</p>
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
      console.error('❌ Failed to notify user in Telegram:', notifyErr.message);
    }

    // Показываем страницу успеха
    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <title>Успешно!</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; text-align: center; padding: 50px 20px; background: #f0f4f8; }
            .success { background: white; padding: 36px; border-radius: 12px; max-width: 500px; margin: 0 auto; box-shadow: 0 4px 20px rgba(0,0,0,0.06); }
            h1 { color: #2e7d32; font-size: 26px; }
            p { color: #444; line-height: 1.6; }
            .channel { background: #e8f5e9; color: #1b5e20; padding: 10px 16px; border-radius: 8px; display: inline-block; margin: 12px 0; font-size: 16px; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="success">
            <h1>✅ YouTube подключен!</h1>
            ${channelInfo ? `<div class="channel">📺 ${channelInfo.title}</div>` : ''}
            <p>Ваш аккаунт успешно авторизован. Теперь бот может автоматически выгружать сгенерированные видео на ваш канал.</p>
            <p style="color: #777;">Можете закрыть эту страницу и вернуться в Telegram бот.</p>
          </div>
        </body>
      </html>
    `);
  } catch (error) {
    console.error('❌ Unexpected OAuth callback error:', error);
    res.status(500).send('Internal server error');
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', redirect_uri: authService.redirectUri });
});

const PORT = process.env.YOUTUBE_OAUTH_PORT || 3001;

app.listen(PORT, () => {
  console.log(`🌐 YouTube OAuth server running on port ${PORT}`);
  console.log(`📍 Callback URL: ${authService.redirectUri}`);
});
