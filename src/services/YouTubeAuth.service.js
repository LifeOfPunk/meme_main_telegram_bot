import { google } from 'googleapis';
import redisClient from '../redis.js';

export class YouTubeAuthService {
  constructor() {
    this.clientId = process.env.YOUTUBE_CLIENT_ID;
    this.clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
    this.redirectUri = `${process.env.WEBHOOK_DOMAIN || 'https://api.aiviral-agency.com'}/youtube-oauth`;
  }

  /**
   * Генерация URL для авторизации пользователя
   */
  getAuthUrl(userId) {
    const oauth2Client = new google.auth.OAuth2(this.clientId, this.clientSecret, this.redirectUri);

    const scopes = [
      'https://www.googleapis.com/auth/youtube.upload',
      'https://www.googleapis.com/auth/youtube',
      'https://www.googleapis.com/auth/youtube.force-ssl',
    ];

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent',
      state: userId.toString(), // Передаем userId в state
    });

    return authUrl;
  }

  /**
   * Обмен кода на токены
   */
  async exchangeCodeForTokens(code) {
    try {
      const oauth2Client = new google.auth.OAuth2(this.clientId, this.clientSecret, this.redirectUri);

      const { tokens } = await oauth2Client.getToken(code);

      return {
        success: true,
        tokens,
      };
    } catch (error) {
      console.error('❌ Error exchanging code for tokens:', error.message);
      return {
        success: false,
        error: error.message,
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
      console.error('❌ Error getting channel info:', error.message);
      return null;
    }
  }
}
