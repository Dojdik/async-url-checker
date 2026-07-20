import { Body, Controller, Get, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { JobsCreateDto } from './dto/jobs-create.dto';
import { JobsListDto } from './dto/jobs-list.dto';
import { JobService } from './job.service';

@Controller('jobs')
export class JobController {
  constructor(private readonly jobService: JobService) {}

  @Post()
  async createJob(@Body() createDto: JobsCreateDto) {
    return this.jobService.create(createDto.urls);
  }

  @Get()
  async listJobs(@Query() listDto: JobsListDto) {
    return this.jobService.findAll(listDto.offset, listDto.count);
  }

  @Get(':id')
  async getJob(@Param('id', ParseIntPipe) id: number) {
    return this.jobService.find(id);
  }
}
