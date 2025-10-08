import fs from 'fs';
import path from 'path';
import winston from 'winston';

const logsDir = path.resolve('logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

export const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.printf(({ level, message, timestamp, ...meta }) => {
      const rest = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
      return `${timestamp} [${level}] ${message}${rest}`;
    })
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.timestamp({ format: 'HH:mm:ss' }),
        winston.format.printf(({ level, message, timestamp }) => `${timestamp} [${level}] ${message}`)
      )
    }),
    new winston.transports.File({ filename: path.join(logsDir, 'app.log') })
  ]
});

export function logUpdate(prefix: string, update: any) {
  try {
    const type = update?.update_id ? Object.keys(update).find(k => k !== 'update_id') : undefined;
    logger.info(`${prefix} incoming update: ${type || 'unknown'}`);
  } catch (e) {
    logger.error(`Failed to log update: ${(e as Error).message}`);
  }
}
