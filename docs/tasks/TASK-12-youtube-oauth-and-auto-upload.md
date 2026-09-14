# TASK-12: Настройка YouTube OAuth и автозагрузки видео

## 1. Проблема
При попытке привязать YouTube канал возникает ошибка Google OAuth:
`400: invalid_request - Missing required parameter: redirect_uri`.
Пользователи не могут привязать аккаунт для автовыгрузки роликов на YouTube.

## 2. Причины
1. В Google Cloud Console проект `snappy-sight-505517-j8` не настроен должным образом (отсутствует привязка платежного аккаунта / включенный YouTube Data API v3).
2. В OAuth 2.0 Client Credentials не прописан `Authorized redirect URIs`:
   - `https://api.aiviral-agency.com/youtube-oauth`
3. В коде генерации URL (`YouTubeAuth.service.js`) требуется гарантированная передача корректного `redirect_uri`.

## 3. Требования
1. Проверить конфигурацию Google Cloud OAuth клиента.
2. Обновить `redirectUri` в `src/services/YouTubeAuth.service.js` с fallback на текущий хост.
3. Протестировать авторизацию тестовым Google-аккаунтом и получение refresh token в Redis.
4. Добавить логирование ошибок загрузки видео в YouTube Data API v3.

## 4. DoD
- Ссылка авторизации открывает окно согласия Google без ошибки 400.
- После выдачи прав токен сохраняется в Redis (`youtube_tokens:{userId}`).
- Бот может выгружать сгенерированное видео на канал пользователя.
