import { Injectable, Logger } from '@nestjs/common';
import type { ILogger } from '../../interfaces/logger.interface';

@Injectable()
export class ConsoleLoggerService implements ILogger {
  private readonly logger = new Logger('App');

  info(message: string, context?: Record<string, unknown>): void {
    this.logger.log(this.format(message, context));
  }

  error(message: string, context?: Record<string, unknown>): void {
    this.logger.error(this.format(message, context));
  }

  warn(message: string, context?: Record<string, unknown>): void {
    this.logger.warn(this.format(message, context));
  }

  private format(message: string, context?: Record<string, unknown>): string {
    if (!context || Object.keys(context).length === 0) {
      return message;
    }
    return `${message} ${JSON.stringify(context)}`;
  }
}
