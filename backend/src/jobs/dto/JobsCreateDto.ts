import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsUrl } from 'class-validator';

export class JobsCreateDto {
    @ApiProperty()
    @IsUrl()
    @IsArray()
    urls!: string[];
}