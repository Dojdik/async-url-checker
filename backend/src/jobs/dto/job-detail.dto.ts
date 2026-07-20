import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { JobStatus } from '../../domain/types/job-status.type';

/** API-facing URL status (maps domain completed→success, failed→error). */
export type ApiUrlStatus =
  | 'pending'
  | 'in_progress'
  | 'success'
  | 'error'
  | 'cancelled';

export class JobUrlDetailDto {
  @ApiProperty()
  url: string;

  @ApiProperty({
    enum: ['pending', 'in_progress', 'success', 'error', 'cancelled'],
  })
  status: ApiUrlStatus;

  @ApiPropertyOptional({ description: 'HTTP status code from HEAD, if any' })
  httpStatus?: number;

  @ApiPropertyOptional({ description: 'Error message, if any' })
  error?: string;

  @ApiPropertyOptional({ description: 'Processing start time' })
  startedAt?: Date;

  @ApiPropertyOptional({ description: 'Processing end time' })
  endedAt?: Date;

  @ApiPropertyOptional({
    description: 'Duration in milliseconds (endedAt - startedAt)',
  })
  durationMs?: number;
}

export class JobDetailDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty({
    enum: ['pending', 'in_progress', 'completed', 'cancelled', 'failed'],
  })
  status: JobStatus;

  @ApiProperty({ type: [JobUrlDetailDto] })
  urls: JobUrlDetailDto[];
}
