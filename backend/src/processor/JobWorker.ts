import { Job } from "@/common/Job";
import EventEmitter from "events";

export class JobWorker extends EventEmitter {
    queue: string[]

    addJob(job: Job) {
        for (let url of job.urls) {
            this.queue.push(url)
        }
        
    }
}