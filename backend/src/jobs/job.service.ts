import { Injectable, NotFoundException } from '@nestjs/common';
import { Job } from '../common/Job';

@Injectable()
export class JobService {
    private jobsList: Job[] = []
    private jobsMap: Map<number, Job> = new Map()

    async create(urls: string[]) {
        const job = new Job(urls)
        this.jobsMap[job.id] = job
        this.jobsList.push(job)
        job.start()
    }

    async findAll(offset: number, count: number) {

        console.log(this.jobsList)

        return this.jobsList.slice(offset, count).map(x => ({
            id: x.id,
            createdAt: x.createdAt,
            status: x.status
        }))
    }

    async find(id: number): Promise<Job> {
        if (this.jobsMap[id])
            return this.jobsMap[id]

        throw new NotFoundException("Job not found")
    }

    async delete(id: number) {
        const deleted = this.jobsList.splice(id-1, 1)

        if (deleted.length == 0) {
            throw new NotFoundException("Job not found")
        }
    }
}
