import { Injectable } from "@nestjs/common";

@Injectable()
export class HttpClientService implements IHttpClient {
  async head(url: string): Promise<{ status: number }> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    
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