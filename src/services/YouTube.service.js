import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';

export class YouTubeService {
    constructor() {
        this.oauth2Client = null;
        this.youtube = null;
        this.isInitialized = false;
    }

    /**
     * Инициализация YouTube API
     */
    async initialize() {
        try {
            const clientId = process.env.YOUTUBE_CLIENT_ID;
            const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
            const refreshToken = process.env.YOUTUBE_REFRESH_TOKEN;

            if (!clientId || !clientSecret || !refreshToken) {
                console.log('⚠️ YouTube API credentials not configured');
                return false;
            }

            this.oauth2Client = new google.auth.OAuth2(
                clientId,
                clientSecret,
                'urn:ietf:wg:oauth:2.0:oob'
            );

            this.oauth2Client.setCredentials({
                refresh_token: refreshToken
            });

            this.youtube = google.youtube({
                version: 'v3',
                auth: this.oauth2Client
            });

            this.isInitialized = true;
            console.log('✅ YouTube API initialized');
            return true;
        } catch (error) {
            console.error('❌ Failed to initialize YouTube API:', error.message);
            return false;
        }
    }

    /**
     * Загрузка видео на YouTube
     * @param {string} videoPath - путь к видео файлу
     * @param {object} metadata - метаданные видео
     * @returns {Promise<object>} - результат загрузки
     */
    async uploadVideo(videoPath, metadata = {}) {
        try {
            if (!this.isInitialized) {
                const initialized = await this.initialize();
                if (!initialized) {
                    return { error: 'YouTube API not configured' };
                }
            }

            console.log('📤 Uploading video to YouTube:', videoPath);

            const {
                title = 'Мем видео',
                description = 'Создано с помощью MeeMee Bot',
                tags = ['мем', 'видео', 'meemee'],
                categoryId = '23', // Comedy
                privacyStatus = 'public' // public, private, unlisted
            } = metadata;

            const fileSize = fs.statSync(videoPath).size;
            console.log(`📊 Video size: ${(fileSize / 1024 / 1024).toFixed(2)} MB`);

            const response = await this.youtube.videos.insert({
                part: ['snippet', 'status'],
                requestBody: {
                    snippet: {
                        title,
                        description,
                        tags,
                        categoryId
                    },
                    status: {
                        privacyStatus,
                        selfDeclaredMadeForKids: false
                    }
                },
                media: {
                    body: fs.createReadStream(videoPath)
                }
            });

            const videoId = response.data.id;
            const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

            console.log('✅ Video uploaded to YouTube:', videoUrl);

            return {
                success: true,
                videoId,
                videoUrl,
                title: response.data.snippet.title
            };

        } catch (error) {
            console.error('❌ Failed to upload video to YouTube:', error.message);
            return {
                error: error.message,
                details: error.response?.data || error
            };
        }
    }

    /**
     * Получение информации о канале
     */
    async getChannelInfo() {
        try {
            if (!this.isInitialized) {
                await this.initialize();
            }

            const response = await this.youtube.channels.list({
                part: ['snippet', 'statistics'],
                mine: true
            });

            if (response.data.items && response.data.items.length > 0) {
                const channel = response.data.items[0];
                return {
                    id: channel.id,
                    title: channel.snippet.title,
                    subscribers: channel.statistics.subscriberCount,
                    videos: channel.statistics.videoCount,
                    views: channel.statistics.viewCount
                };
            }

            return null;
        } catch (error) {
            console.error('❌ Failed to get channel info:', error.message);
            return null;
        }
    }

    /**
     * Удаление видео с YouTube
     */
    async deleteVideo(videoId) {
        try {
            if (!this.isInitialized) {
                await this.initialize();
            }

            await this.youtube.videos.delete({
                id: videoId
            });

            console.log('✅ Video deleted from YouTube:', videoId);
            return { success: true };

        } catch (error) {
            console.error('❌ Failed to delete video:', error.message);
            return { error: error.message };
        }
    }

    /**
     * Обновление метаданных видео
     */
    async updateVideo(videoId, metadata) {
        try {
            if (!this.isInitialized) {
                await this.initialize();
            }

            const response = await this.youtube.videos.update({
                part: ['snippet', 'status'],
                requestBody: {
                    id: videoId,
                    snippet: metadata.snippet,
                    status: metadata.status
                }
            });

            console.log('✅ Video updated on YouTube:', videoId);
            return { success: true, data: response.data };

        } catch (error) {
            console.error('❌ Failed to update video:', error.message);
            return { error: error.message };
        }
    }
}
