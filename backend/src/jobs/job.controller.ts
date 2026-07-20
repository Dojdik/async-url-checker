import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { JobsCreateDto } from './dto/JobsCreateDto';
import { JobService } from '@/jobs/job.service';
import { JobsListDto } from './dto/JobsListDto';

@Controller('jobs')
export class JobController {

    constructor(private readonly jobService: JobService) {}

    @Post()
    async createJob(@Body() createDto: JobsCreateDto) {
        return this.jobService.create(createDto.urls)
    }

    @Get()
    async listJobs(@Query() listDto: JobsListDto) {
        return this.jobService.findAll(listDto.offset, listDto.count)
    }
}
