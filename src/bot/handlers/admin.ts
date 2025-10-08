import { Telegraf, Context } from 'telegraf';
import fs from 'fs';
import path from 'path';
import { countByDate, listByDate, listAll, toCsv } from '../../services/db';
import { logger } from '../../services/logger';

function parseDateArg(text?: string): string | null {
  if (!text) return null;
  const parts = text.trim().split(/\s+/);
  if (parts.length < 2) return null;
  const date = parts[1];
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null;
}

export function registerAdminHandlers(adminBot: Telegraf<Context>) {
  adminBot.command('stats', async (ctx) => {
    const date = parseDateArg(ctx.message?.text);
    if (!date) {
      await ctx.reply('Использование: /stats YYYY-MM-DD');
      return;
    }
    const cnt = countByDate(date);
    logger.info(`Admin /stats for ${date} => ${cnt}`);
    await ctx.reply(`За ${date}: ${cnt}`);
  });

  adminBot.command('list', async (ctx) => {
    const date = parseDateArg(ctx.message?.text);
    if (!date) {
      await ctx.reply('Использование: /list YYYY-MM-DD');
      return;
    }
    const rows = listByDate(date);
    logger.info(`Admin /list for ${date} => ${rows.length} rows`);
    if (rows.length === 0) {
      await ctx.reply('Пусто');
      return;
    }
    const lines = rows.map(r => `• ${r.video_generate_name} (${r.username}, ${r.utm_source})`);
    const text = `Список за ${date} (всего: ${rows.length}):\n\n${lines.join('\n')}`;
    await ctx.reply(text);
  });

  adminBot.command('export', async (ctx) => {
    const text = ctx.message?.text || '';
    const parts = text.trim().split(/\s+/);
    const arg = parts[1];
    if (!arg) {
      await ctx.reply('Использование: /export YYYY-MM-DD | all');
      return;
    }

    let rows;
    let label: string;
    if (arg.toLowerCase() === 'all') {
      rows = listAll();
      label = 'all';
    } else if (/^\d{4}-\d{2}-\d{2}$/.test(arg)) {
      rows = listByDate(arg);
      label = arg;
    } else {
      await ctx.reply('Неверный аргумент. Использование: /export YYYY-MM-DD | all');
      return;
    }

    const csv = toCsv(rows);

    const exportsDir = path.resolve('exports');
    fs.mkdirSync(exportsDir, { recursive: true });
    const filePath = path.join(exportsDir, `export_${label}.csv`);
    fs.writeFileSync(filePath, csv, 'utf8');

    logger.info(`Admin /export for ${label} => ${rows.length} rows written to ${filePath}`);
    await ctx.replyWithDocument({ source: filePath });
  });
}
