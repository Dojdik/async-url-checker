import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { IHttpClient } from '../../interfaces/http-client.interface';
import type { AppConfiguration } from '../../config/configuration';

@Injectable()
export class HttpClientService implements IHttpClient {
  private readonly timeoutMs: number;

  constructor(config: ConfigService<AppConfiguration, true>) {
    this.timeoutMs = config.get('httpTimeoutMs', { infer: true });
  }

  async head(url: string): Promise<{ status: number }> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(url, {
        method: 'HEAD',
        signal: controller.signal,
        headers: {
          'User-Agent': 'JobWorker/1.0',
        },
      });
      return { status: response.status };
    } finally {
      clearTimeout(timeout);
    }
  }
}
