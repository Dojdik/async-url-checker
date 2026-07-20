import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { JobsCreateDto } from './dto/JobsCreateDto';
import { JobsService } from './jobs.service';
import { JobsListDto } from './dto/JobsListDto';

@Controller('jobs')
export class JobsController {

    constructor(private readonly jobsService: JobsService) {}

    @Post()
    async createJob(@Body() createDto: JobsCreateDto) {
        return this.jobsService.create(createDto.urls)
    }

    @Get()
    async listJobs(@Query() listDto: JobsListDto) {
        return this.jobsService.findAll(listDto.offset, listDto.count)
    }
}
