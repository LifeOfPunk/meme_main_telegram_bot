import 'dotenv/config';
import { Telegraf, Context } from 'telegraf';
import { logger, logUpdate } from '../services/logger';
import { handleStart } from './handlers/start';
import { registerNameHandlers, useNameSession } from './handlers/name';
import { registerAdminHandlers } from './handlers/admin';

function mustEnv(name: string): string | null {
  const v = process.env[name];
  return (v && v.trim()) ? v.trim() : null;
}

async function bootstrap() {
  const token = mustEnv('BOT_TOKEN');
  if (!token) {
    logger.error('BOT_TOKEN is not set in environment');
    process.exit(1);
  }

  const bot = new Telegraf<Context>(token);

  // Log all incoming updates
  bot.use(async (ctx, next) => {
    try {
      logUpdate('BOT', ctx.update);
    } catch {}
    return next();
  });

  // Persist session for name confirmation
  useNameSession(bot as any);

  // Commands and handlers
  bot.start(handleStart);
  registerNameHandlers(bot as any);

  // Error catcher
  bot.catch((err, ctx) => {
    logger.error(`BOT error: ${(err as any)?.message || err}`);
    try { ctx.reply('❌ Что-то пошло не так. Попробуй ещё раз позже.'); } catch {}
  });

  bot.launch().then(() => logger.info('User bot launched')).catch((e) => logger.error('User bot failed: ' + e?.message));

  // Admin bot
  const adminToken = mustEnv('ADMIN_BOT_TOKEN');
  if (adminToken) {
    const adminBot = new Telegraf<Context>(adminToken);
    adminBot.use(async (ctx, next) => {
      try { logUpdate('ADMIN', ctx.update); } catch {}
      return next();
    });

    registerAdminHandlers(adminBot);

    adminBot.catch((err, ctx) => {
      logger.error(`ADMIN error: ${(err as any)?.message || err}`);
      try { ctx.reply('Ошибка'); } catch {}
    });

    adminBot.launch().then(() => logger.info('Admin bot launched')).catch((e) => logger.error('Admin bot failed: ' + e?.message));
  } else {
    logger.info('ADMIN_BOT_TOKEN not set; admin bot disabled');
  }

  // Enable graceful stop
  process.once('SIGINT', () => { bot.stop('SIGINT'); });
  process.once('SIGTERM', () => { bot.stop('SIGTERM'); });
}

bootstrap();
