import { ApiProperty } from '@nestjs/swagger';
import type { JobStatus } from '../../domain/types/job-status.type';

export class JobUrlStatsDto {
  @ApiProperty({ description: 'URLs completed successfully (status=completed)' })
  succeeded: number;

  @ApiProperty({ description: 'URLs that failed (status=failed)' })
  failed: number;

  @ApiProperty({ description: 'URLs still pending' })
  pending: number;

  @ApiProperty({ description: 'URLs currently being checked' })
  in_progress: number;

  @ApiProperty({ description: 'URLs cancelled before start' })
  cancelled: number;
}

/** Brief job row for GET /api/jobs */
export class JobListItemDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty({
    enum: ['pending', 'in_progress', 'completed', 'cancelled', 'failed'],
  })
  status: JobStatus;

  @ApiProperty({ description: 'Total number of URLs in the job' })
  urlsCount: number;

  @ApiProperty({ type: JobUrlStatsDto })
  stats: JobUrlStatsDto;
}
