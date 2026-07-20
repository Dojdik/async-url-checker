export interface IHttpClient {
  head(url: string): Promise<{ status: number }>;
}
