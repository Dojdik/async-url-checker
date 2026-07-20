import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNumber } from 'class-validator';
import { dtoQueryNumber } from '../../utils';

export class JobsListDto {
  @ApiProperty({ default: 0, required: false })
  @IsNumber()
  @Transform(dtoQueryNumber)
  offset: number = 0;

  @ApiProperty({ default: 100, required: false })
  @IsNumber()
  @Transform(dtoQueryNumber)
  count: number = 100;
}
