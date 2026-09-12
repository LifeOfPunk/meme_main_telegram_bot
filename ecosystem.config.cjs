module.exports = {
  apps: [
    {
      name: 'viralapp-bot',
      script: 'src/bot_start.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      time: true,
      env: {
        NODE_ENV: 'production',
        BOT_NAME: 'viralapp_official_bot',
      },
    },
    {
      name: 'viralapp-admin',
      script: 'src/bot_start_admin.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '300M',
      time: true,
      env: {
        NODE_ENV: 'production',
      },
    },
    {
      name: 'viralapp-backend',
      script: 'src/backend/index.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '300M',
      time: true,
      env: {
        NODE_ENV: 'production',
        WEBHOOK_PORT: 3005,
      },
    },
    {
      name: 'viralapp-youtube',
      script: 'src/youtube_oauth_server.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '200M',
      time: true,
      env: {
        NODE_ENV: 'production',
        YOUTUBE_OAUTH_PORT: 3006,
      },
    },
  ],
};
