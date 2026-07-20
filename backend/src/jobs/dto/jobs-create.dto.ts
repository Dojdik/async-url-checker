import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsUrl } from 'class-validator';

export class JobsCreateDto {
  @ApiProperty({ type: [String], example: ['https://example.com'] })
  @IsUrl({}, { each: true })
  @IsArray()
  urls!: string[];
}
