import { Injectable } from '@nestjs/common';
import type { IHttpClient } from '../../interfaces/http-client.interface';

@Injectable()
export class HttpClientService implements IHttpClient {
  private readonly timeoutMs = 10_000;

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
