import { Injectable } from '@nestjs/common';
import { JobEntity } from '../entities/job.entity';
import { JobUrlEntity } from '../entities/job-url.entity';
import type { IJobFactory } from '../../interfaces/job-factory.interface';
import type { IJob } from '../../interfaces/job.interface';
import type { IJobUrl } from '../../interfaces/job-url.interface';

@Injectable()
export class JobFactory implements IJobFactory {
  private nextId = 1;

  create(urls: string[]): IJob {
    return new JobEntity(
      this.nextId++,
      urls.map((url) => this.createUrl(url) as JobUrlEntity),
    );
  }

  createUrl(url: string): IJobUrl {
    return new JobUrlEntity(url);
  }
}
