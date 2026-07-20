import { Job } from "@/common/Job";
import { JobUrl } from "@/common/JobUrl";
import EventEmitter from "events";

export class JobWorker extends EventEmitter {
    queue: JobUrl[] = []
    isRunning: boolean = false
    processing: number = 0

    constructor() {
        super()
        this.loop = this.loop.bind(this)
    }

    loop() {
        if (!this.isRunning)
            return

        if (this.processing < 5) {
            const url = this.queue.shift()
            if (url) {
                this.processing++
                url.setInProgress(this)
            }
        }
            

        setTimeout(this.loop, 100)
    }

    decrement() {
        this.processing--
    }

    addJob(job: Job) {
        for (let url of job.urls) {
            this.queue.push(url)
        }
    }

    start() {
        this.isRunning = true
        this.loop()
    }

    stop() {
        this.isRunning = false
    }
}