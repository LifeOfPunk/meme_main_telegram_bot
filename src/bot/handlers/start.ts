import { Context } from 'telegraf';
import { TEXTS } from '../../config/texts';
import { getWelcomeImagePath } from '../../utils/imageHelper';
import { logger } from '../../services/logger';

export async function handleStart(ctx: Context) {
  const user = ctx.from;
  const payload = (ctx as any).startPayload as string | undefined;
  // Persist UTM source in session for later confirmation step
  try {
    (ctx as any).session = (ctx as any).session || {};
    if (payload) (ctx as any).session.utmSource = payload;
  } catch {}
  logger.info(`/start by @${user?.username || user?.id} payload=${payload || ''}`);

  const img = getWelcomeImagePath();
  if (img) {
    await ctx.replyWithPhoto({ source: img }, { caption: TEXTS.welcome });
  } else {
    await ctx.reply(TEXTS.welcome);
  }
}
