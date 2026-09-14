import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import { YouTubeAuthService } from './YouTubeAuth.service.js';

export class YouTubeService {
    constructor() {
        this.clientId = process.env.YOUTUBE_CLIENT_ID;
        this.clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
        this.authService = new YouTubeAuthService();
        this.redirectUri = this.authService.redirectUri;
    }

    /**
     * Инициализация YouTube API для конкретного пользователя
     */
    async initializeForUser(userId) {
        try {
            if (!this.clientId || !this.clientSecret) {
                console.log('⚠️ YouTube API credentials not configured');
                return null;
            }

            const tokens = await this.authService.getUserTokens(userId);

            if (!tokens || !tokens.refresh_token) {
                console.log(`⚠️ User ${userId} not authorized for YouTube`);
                return null;
            }

            const oauth2Client = new google.auth.OAuth2(this.clientId, this.clientSecret, this.redirectUri);

            oauth2Client.setCredentials(tokens);

            const youtube = google.youtube({
                version: 'v3',
                auth: oauth2Client,
            });

            console.log(`✅ YouTube API initialized for user ${userId}`);
            return youtube;
        } catch (error) {
            console.error(`❌ Failed to initialize YouTube API for user ${userId}:`, error.message);
            return null;
        }
    }

    /**
     * Загрузка видео на YouTube для конкретного пользователя
     * @param {number} userId - ID пользователя Telegram
     * @param {string} videoPath - путь к видео файлу
     * @param {object} metadata - метаданные видео
     * @returns {Promise<object>} - результат загрузки
     */
    async uploadVideo(userId, videoPath, metadata = {}) {
        try {
            const youtube = await this.initializeForUser(userId);

            if (!youtube) {
                return {
                    error: 'User not authorized for YouTube',
                    needsAuth: true,
                };
            }

            console.log(`📤 Uploading video to YouTube for user ${userId}:`, videoPath);

            const {
                title = 'Мем видео',
                description = 'Создано с помощью MeeMee Bot',
                tags = ['мем', 'видео', 'meemee'],
                categoryId = '23', // Comedy
                privacyStatus = 'public', // public, private, unlisted
            } = metadata;

            const fileSize = fs.statSync(videoPath).size;
            console.log(`📊 Video size: ${(fileSize / 1024 / 1024).toFixed(2)} MB`);

            const response = await youtube.videos.insert({
                part: ['snippet', 'status'],
                requestBody: {
                    snippet: {
                        title,
                        description,
                        tags,
                        categoryId,
                    },
                    status: {
                        privacyStatus,
                        selfDeclaredMadeForKids: false,
                    },
                },
                media: {
                    body: fs.createReadStream(videoPath),
                },
            });

            const videoId = response.data.id;
            const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

            console.log(`✅ Video uploaded to YouTube for user ${userId}:`, videoUrl);

            return {
                success: true,
                videoId,
                videoUrl,
                title: response.data.snippet.title,
            };
        } catch (error) {
            const errorDetails = error.response?.data?.error || {};
            const errorCode = errorDetails.code || error.code;
            const errorReason = errorDetails.errors?.[0]?.reason || error.message;

            console.error(`❌ Failed to upload video to YouTube for user ${userId}:`, {
                message: error.message,
                code: errorCode,
                reason: errorReason,
                details: errorDetails
            });

            return {
                error: error.message,
                reason: errorReason,
                details: error.response?.data || error,
            };
        }
    }

    /**
     * Получение информации о канале пользователя
     */
    async getChannelInfo(userId) {
        return await this.authService.getUserChannelInfo(userId);
    }

    /**
     * Удаление видео с YouTube
     */
    async deleteVideo(userId, videoId) {
        try {
            const youtube = await this.initializeForUser(userId);

            if (!youtube) {
                return { error: 'User not authorized for YouTube' };
            }

            await youtube.videos.delete({
                id: videoId,
            });

            console.log(`✅ Video deleted from YouTube for user ${userId}:`, videoId);
            return { success: true };
        } catch (error) {
            console.error(`❌ Failed to delete video for user ${userId}:`, error.message);
            return { error: error.message };
        }
    }

    /**
     * Обновление метаданных видео
     */
    async updateVideo(userId, videoId, metadata) {
        try {
            const youtube = await this.initializeForUser(userId);

            if (!youtube) {
                return { error: 'User not authorized for YouTube' };
            }

            const response = await youtube.videos.update({
                part: ['snippet', 'status'],
                requestBody: {
                    id: videoId,
                    snippet: metadata.snippet,
                    status: metadata.status,
                },
            });

            console.log(`✅ Video updated on YouTube for user ${userId}:`, videoId);
            return { success: true, data: response.data };
        } catch (error) {
            console.error(`❌ Failed to update video for user ${userId}:`, error.message);
            return { error: error.message };
        }
    }
}
