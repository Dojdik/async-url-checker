import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { JobsCreateDto } from './dto/jobs-create.dto';
import { JobsListDto } from './dto/jobs-list.dto';
import { JobService } from './job.service';

@ApiTags('jobs')
@Controller('jobs')
export class JobController {
  constructor(private readonly jobService: JobService) {}

  @Post()
  @ApiOperation({ summary: 'Create a URL-check job' })
  async createJob(@Body() createDto: JobsCreateDto) {
    return this.jobService.create(createDto.urls);
  }

  @Get()
  @ApiOperation({ summary: 'List jobs' })
  async listJobs(@Query() listDto: JobsListDto) {
    return this.jobService.findAll(listDto.offset, listDto.count);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get job by id' })
  async getJob(@Param('id', ParseIntPipe) id: number) {
    return this.jobService.find(id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Cancel a job',
    description:
      'Marks the job as cancelled and stops processing of not-started URLs. In-progress URLs may still finish.',
  })
  async cancelJob(@Param('id', ParseIntPipe) id: number) {
    return this.jobService.cancel(id);
  }
}
