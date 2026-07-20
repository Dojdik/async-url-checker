export class JobUrlEntity {
  constructor(
    public readonly url: string,
    public status: UrlStatus = 'pending',
    public httpStatus?: number,
    public error?: string,
    public startedAt: Date = new Date(),
    public endedAt?: Date,
  ) {}
}

export type UrlStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled' | 'failed';