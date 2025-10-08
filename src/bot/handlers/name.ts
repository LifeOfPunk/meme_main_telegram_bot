import { Context, Telegraf, Markup, session } from 'telegraf';
import { TEXTS } from '../../config/texts';
import { addUser, hasAnySubmission } from '../../services/db';
import { logger } from '../../services/logger';

interface SessionData {
  pendingName?: string;
  utmSource?: string;
}

type MyContext = Context & { session: SessionData };

export function useNameSession(bot: Telegraf<MyContext>) {
  bot.use(session({ defaultSession: (): SessionData => ({}) }) as any);
}

function normalizeName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return '';
  // Capitalize first letter of each word (basic)
  return trimmed.replace(/\b\w/g, c => c.toUpperCase());
}

function today(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function resolveUsername(ctx: Context): string {
  const u = ctx.from;
  if (!u) return 'unknown';
  if (u.username) return `@${u.username}`;
  return `id:${u.id}`;
}

function getUtmSourceFromContext(ctx: Context & { session?: any }): string {
  const sUtm = (ctx as any).session?.utmSource;
  const envUtm = process.env.UTM_SOURCE || 'default';
  return sUtm || envUtm;
}

function isSubscriptionCheckEnabled(): boolean {
  return (process.env.SUBSCRIPTION_CHECK_ENABLED ?? 'false').toLowerCase() === 'true';
}

function getSubscriptionChannel(): string | null {
  const ch = process.env.SUBSCRIPTION_CHANNEL;
  return (ch && ch.trim()) ? ch.trim() : null;
}

async function isUserSubscribed(ctx: Context, channel: string): Promise<boolean> {
  try {
    const userId = ctx.from?.id;
    if (!userId) return false;
    const member: any = await ctx.telegram.getChatMember(channel, userId);
    const status = member?.status;
    return status === 'member' || status === 'administrator' || status === 'creator' || status === 'restricted';
  } catch (e: any) {
    logger.error(`getChatMember failed: ${e?.message || e}`);
    return false;
  }
}

export function registerNameHandlers(bot: Telegraf<MyContext>) {
  // Capture name from any text message that is not a command
  bot.on('text', async (ctx) => {
    const text = ctx.message?.text || '';
    if (text.startsWith('/')) return; // ignore commands

    const norm = normalizeName(text);
    if (!norm) return;

    ctx.session.pendingName = norm;
    logger.info(`Name entered by ${resolveUsername(ctx)} => ${norm}`);

    const keyboard = Markup.inlineKeyboard([
      [
        Markup.button.callback('Да', 'confirm_yes'),
        Markup.button.callback('Нет', 'confirm_no')
      ]
    ]);

    await ctx.reply(TEXTS.confirmName(norm), { parse_mode: 'HTML', ...keyboard });
  });

  bot.action('confirm_no', async (ctx) => {
    await ctx.answerCbQuery('Ок, напишите имя ещё раз.');
    await ctx.editMessageText('Напишите имя ещё раз.');
    logger.info(`User ${resolveUsername(ctx)} chose NO on confirmation`);
  });

  bot.action('confirm_yes', async (ctx) => {
    try {
      const name = (ctx as any).session?.pendingName as string | undefined;
      if (!name) {
        await ctx.answerCbQuery('Имя не найдено в сессии, отправьте снова.');
        logger.error(`Confirmation without pendingName by ${resolveUsername(ctx)}`);
        return;
      }

      const username = resolveUsername(ctx);

      // If subscription check is enabled, prompt to subscribe and defer DB insert
      const subEnabled = isSubscriptionCheckEnabled();
      const channel = getSubscriptionChannel();
      if (subEnabled && channel) {
        const keyboard = Markup.inlineKeyboard([
          [Markup.button.url(TEXTS.subscribeBtn, channel.startsWith('http') ? channel : `https://t.me/${channel.replace(/^@/, '')}`)],
          [Markup.button.callback(TEXTS.subscribeCheckBtn, 'check_subscription')]
        ]);
        await ctx.answerCbQuery('');
        await ctx.reply(TEXTS.subscribeRequest(channel), keyboard as any);
        logger.info(`User ${username} prompted to subscribe to ${channel}`);
        return;
      }

      // Otherwise proceed immediately
      const enforceSingle = (process.env.USER_SINGLE_SUBMISSION_ENFORCE ?? 'true').toLowerCase() !== 'false';
      if (enforceSingle && hasAnySubmission(username)) {
        logger.info(`User ${username} attempted additional submission — blocked by policy`);
        await ctx.answerCbQuery('Уже участвовали');
        await ctx.reply(TEXTS.alreadyUsed || 'Вы уже использовали свою попытку.');
        return;
      }

      const date = today();
      const utmSource = getUtmSourceFromContext(ctx as any);
      const res = addUser({ utm_source: utmSource, date, username, video_generate_name: name });
      if (res.inserted) {
        logger.info(`Saved user: ${username}, utm=${utmSource}, date=${date}, name=${name}`);
      } else {
        logger.info(`User already saved (duplicate for utm pair): ${username}, utm=${utmSource}`);
      }

      await ctx.answerCbQuery('Сохранено');
      await ctx.reply(TEXTS.nameAccepted);
    } catch (e: any) {
      logger.error(`confirm_yes error: ${e?.message || e}`);
      await ctx.reply(TEXTS.error);
    }
  });

  bot.action('check_subscription', async (ctx) => {
    try {
      const name = (ctx as any).session?.pendingName as string | undefined;
      const username = resolveUsername(ctx);
      const channel = getSubscriptionChannel();

      if (!channel) {
        await ctx.answerCbQuery('Ошибка настройки');
        await ctx.reply(TEXTS.error);
        logger.error('SUBSCRIPTION_CHANNEL is not set while checking subscription');
        return;
      }

      if (!name) {
        await ctx.answerCbQuery('Имя не найдено, отправьте его снова');
        await ctx.reply('Пожалуйста, напишите своё имя ещё раз.');
        return;
      }

      const isSub = await isUserSubscribed(ctx, channel);
      if (!isSub) {
        await ctx.answerCbQuery('Нет подписки');
        await ctx.reply(TEXTS.subscribeFail);
        logger.info(`User ${username} is NOT subscribed to ${channel}`);
        return;
      }

      await ctx.answerCbQuery('OK');
      await ctx.reply(TEXTS.subscribeOk);

      // Enforce single submission before adding
      const enforceSingle = (process.env.USER_SINGLE_SUBMISSION_ENFORCE ?? 'true').toLowerCase() !== 'false';
      if (enforceSingle && hasAnySubmission(username)) {
        logger.info(`User ${username} attempted additional submission — blocked by policy (after sub)`);
        await ctx.reply(TEXTS.alreadyUsed || 'Вы уже использовали свою попытку.');
        return;
      }

      const date = today();
      const utmSource = getUtmSourceFromContext(ctx as any);
      const res = addUser({ utm_source: utmSource, date, username, video_generate_name: name });
      if (res.inserted) {
        logger.info(`Saved user (after sub): ${username}, utm=${utmSource}, date=${date}, name=${name}`);
        // Clear pending to avoid duplicates on repeated checks
        (ctx as any).session.pendingName = undefined;
      } else {
        logger.info(`User already saved (duplicate for utm pair): ${username}, utm=${utmSource}`);
      }

      await ctx.reply(TEXTS.nameAccepted);
    } catch (e: any) {
      logger.error(`check_subscription error: ${e?.message || e}`);
      await ctx.reply(TEXTS.error);
    }
  });
}
