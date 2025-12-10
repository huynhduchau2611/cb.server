import fs from 'fs';
import path from 'path';

export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  DEBUG = 'debug'
}

class Logger {
  private logDir: string;

  constructor() {
    this.logDir = path.join(process.cwd(), 'logs');
    this.ensureLogDir();
  }

  private ensureLogDir(): void {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  private formatMessage(level: LogLevel, message: string, meta?: any): string {
    const timestamp = new Date().toISOString();
    const metaStr = meta ? ` ${JSON.stringify(meta)}` : '';
    return `[${timestamp}] [${level.toUpperCase()}] ${message}${metaStr}\n`;
  }

  private writeToFile(level: LogLevel, message: string, meta?: any): void {
    const logFile = path.join(this.logDir, `${level}.log`);
    const formattedMessage = this.formatMessage(level, message, meta);

    fs.appendFileSync(logFile, formattedMessage);
  }

  private log(level: LogLevel, message: string, meta?: any): void {
    // Console output
    const timestamp = new Date().toISOString();
    const metaStr = meta ? ` ${JSON.stringify(meta)}` : '';

    switch (level) {
    case LogLevel.ERROR:
      console.error(`[${timestamp}] [ERROR] ${message}${metaStr}`);
      break;
    case LogLevel.WARN:
      console.warn(`[${timestamp}] [WARN] ${message}${metaStr}`);
      break;
    case LogLevel.INFO:
      console.info(`[${timestamp}] [INFO] ${message}${metaStr}`);
      break;
    case LogLevel.DEBUG:
      console.debug(`[${timestamp}] [DEBUG] ${message}${metaStr}`);
      break;
    }

    // File output
    this.writeToFile(level, message, meta);
  }

  error(message: string, meta?: any): void {
    this.log(LogLevel.ERROR, message, meta);
  }

  warn(message: string, meta?: any): void {
    this.log(LogLevel.WARN, message, meta);
  }

  info(message: string, meta?: any): void {
    this.log(LogLevel.INFO, message, meta);
  }

  debug(message: string, meta?: any): void {
    this.log(LogLevel.DEBUG, message, meta);
  }
}

export const logger = new Logger();
