import { google } from 'googleapis';
import redisClient from '../redis.js';

export class YouTubeAuthService {
  constructor() {
    this.clientId = process.env.YOUTUBE_CLIENT_ID;
    this.clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
    this.redirectUri = this.resolveRedirectUri();
  }

  /**
   * Разрешение redirect_uri:
   * 1. YOUTUBE_REDIRECT_URI из env
   * 2. WEBHOOK_DOMAIN/youtube-oauth
   * 3. Дефолт https://api.aiviral-agency.com/youtube-oauth
   */
  resolveRedirectUri() {
    if (process.env.YOUTUBE_REDIRECT_URI && process.env.YOUTUBE_REDIRECT_URI.trim()) {
      return process.env.YOUTUBE_REDIRECT_URI.trim();
    }
    if (process.env.WEBHOOK_DOMAIN && process.env.WEBHOOK_DOMAIN.trim()) {
      const domain = process.env.WEBHOOK_DOMAIN.trim().replace(/\/+$/, '');
      const domainWithProto = domain.startsWith('http') ? domain : `https://${domain}`;
      return `${domainWithProto}/youtube-oauth`;
    }
    return 'https://api.aiviral-agency.com/youtube-oauth';
  }

  /**
   * Обработка и подробное логирование частых ошибок Google OAuth
   */
  handleOAuthError(context, error) {
    const errorData = error.response?.data || {};
    const errorCode = errorData.error || error.code || 'UNKNOWN_ERROR';
    const errorDescription = errorData.error_description || error.message;

    let friendlyMessage = 'Произошла ошибка при авторизации Google OAuth';

    switch (errorCode) {
      case 'redirect_uri_mismatch':
        friendlyMessage = `Несовпадение redirect_uri. Убедитесь, что в Google Cloud Console добавлен Authorized redirect URI: ${this.redirectUri}`;
        break;
      case 'invalid_request':
        friendlyMessage = 'Некорректный запрос авторизации Google (отсутствует обязательный параметр redirect_uri или code)';
        break;
      case 'invalid_client':
        friendlyMessage = 'Ошибка аутентификации клиента Google (проверьте YOUTUBE_CLIENT_ID и YOUTUBE_CLIENT_SECRET)';
        break;
      case 'invalid_grant':
        friendlyMessage = 'Код подтверждения Google истек или уже был использован';
        break;
      case 'access_denied':
        friendlyMessage = 'Доступ к YouTube каналу был отклонен пользователем';
        break;
      case 'unauthorized_client':
        friendlyMessage = 'Клиент не авторизован для данного метода OAuth';
        break;
      case 'quotaExceeded':
      case 'dailyLimitExceeded':
        friendlyMessage = 'Превышена суточная квота запросов к YouTube Data API v3';
        break;
      default:
        if (error.message?.includes('redirect_uri')) {
          friendlyMessage = `Ошибка параметра redirect_uri (${this.redirectUri})`;
        }
        break;
    }

    console.error(`❌ [Google OAuth Error][${context}]:`, {
      code: errorCode,
      description: errorDescription,
      friendlyMessage,
      redirectUri: this.redirectUri,
      status: error.response?.status,
      timestamp: new Date().toISOString()
    });

    return {
      code: errorCode,
      description: errorDescription,
      friendlyMessage,
    };
  }

  /**
   * Генерация URL для авторизации пользователя
   */
  getAuthUrl(userId) {
    if (!this.clientId) {
      console.error('❌ YOUTUBE_CLIENT_ID is missing');
      throw new Error('YOUTUBE_CLIENT_ID is not configured');
    }

    const redirectUri = this.redirectUri || 'https://api.aiviral-agency.com/youtube-oauth';
    const oauth2Client = new google.auth.OAuth2(this.clientId, this.clientSecret, redirectUri);

    const scopes = [
      'https://www.googleapis.com/auth/youtube.upload',
      'https://www.googleapis.com/auth/youtube',
      'https://www.googleapis.com/auth/youtube.force-ssl',
    ];

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent',
      state: userId ? userId.toString() : '0', // Передаем userId в state
      redirect_uri: redirectUri, // Гарантированно передаем redirect_uri
    });

    console.log(`🔗 Generated YouTube OAuth URL for user ${userId} with redirect_uri: ${redirectUri}`);
    return authUrl;
  }

  /**
   * Обмен кода на токены
   */
  async exchangeCodeForTokens(code) {
    try {
      if (!code) {
        throw new Error('Missing authorization code');
      }

      const redirectUri = this.redirectUri || 'https://api.aiviral-agency.com/youtube-oauth';
      const oauth2Client = new google.auth.OAuth2(this.clientId, this.clientSecret, redirectUri);

      const { tokens } = await oauth2Client.getToken({
        code,
        redirect_uri: redirectUri
      });

      return {
        success: true,
        tokens,
      };
    } catch (error) {
      const parsedError = this.handleOAuthError('exchangeCodeForTokens', error);
      return {
        success: false,
        error: parsedError.friendlyMessage || error.message,
        errorCode: parsedError.code,
        details: parsedError.description,
      };
    }
  }

  /**
   * Сохранение токенов пользователя в Redis
   */
  async saveUserTokens(userId, tokens) {
    try {
      const key = `youtube_tokens:${userId}`;
      await redisClient.set(key, JSON.stringify(tokens));
      console.log(`✅ Saved YouTube tokens for user ${userId}`);
      return true;
    } catch (error) {
      console.error('❌ Error saving user tokens:', error.message);
      return false;
    }
  }

  /**
   * Получение токенов пользователя из Redis
   */
  async getUserTokens(userId) {
    try {
      const key = `youtube_tokens:${userId}`;
      const tokensStr = await redisClient.get(key);

      if (!tokensStr) {
        return null;
      }

      return JSON.parse(tokensStr);
    } catch (error) {
      console.error('❌ Error getting user tokens:', error.message);
      return null;
    }
  }

  /**
   * Проверка, авторизован ли пользователь
   */
  async isUserAuthorized(userId) {
    const tokens = await this.getUserTokens(userId);
    return tokens !== null && tokens.refresh_token;
  }

  /**
   * Удаление токенов пользователя
   */
  async revokeUserTokens(userId) {
    try {
      const key = `youtube_tokens:${userId}`;
      await redisClient.del(key);
      console.log(`✅ Revoked YouTube tokens for user ${userId}`);
      return true;
    } catch (error) {
      console.error('❌ Error revoking user tokens:', error.message);
      return false;
    }
  }

  /**
   * Получение информации о канале пользователя
   */
  async getUserChannelInfo(userId) {
    try {
      const tokens = await this.getUserTokens(userId);

      if (!tokens) {
        return null;
      }

      const oauth2Client = new google.auth.OAuth2(this.clientId, this.clientSecret, this.redirectUri);

      oauth2Client.setCredentials(tokens);

      const youtube = google.youtube({ version: 'v3', auth: oauth2Client });

      const response = await youtube.channels.list({
        part: ['snippet', 'statistics'],
        mine: true,
      });

      if (response.data.items && response.data.items.length > 0) {
        const channel = response.data.items[0];
        return {
          id: channel.id,
          title: channel.snippet.title,
          subscribers: channel.statistics.subscriberCount,
          videos: channel.statistics.videoCount,
        };
      }

      return null;
    } catch (error) {
      this.handleOAuthError('getUserChannelInfo', error);
      return null;
    }
  }
}
