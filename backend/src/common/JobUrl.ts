import { JobWorker } from "@/processor/JobWorker"
import { randomDelay } from "@/utils"
import timers from 'timers/promises'

export class JobUrl {
    url: string
    status: "pending" | "in_progress" | "completed" | "cancelled" | "failed"
    httpStatus?: number
    error?: string
    startedAt: Date
    endedAt?: Date
    private jobWorker?: JobWorker

    constructor(url: string) {
        this.url = url
        this.startedAt = new Date()
        this.status = "pending"
    }

    private emitStatus() {
        if (this.jobWorker == null) throw new ReferenceError("jobWorker must be set")
        this.jobWorker.emit('job_status', this)
    }

    private setCompleted(httpStatus: number) {
        if (this.jobWorker == null) throw new ReferenceError("jobWorker must be set")
        this.status = "completed"
        this.httpStatus = httpStatus
        this.emitStatus()
    }

    private setFailed(error: string) {
        if (this.jobWorker == null) throw new ReferenceError("jobWorker must be set")
        this.status = "failed"
        this.error = error
        this.emitStatus()
    }


    setInProgress(jobWorker: JobWorker) {
        if (this.jobWorker != null) throw new ReferenceError("jobWorker must be unset")
        this.jobWorker = jobWorker
        this.emitStatus()

        console.log(this.url, 'x')

        fetch(this.url, {
            method: "HEAD"
        }).then(async x => {
            console.log('delaying')
            await timers.setTimeout(randomDelay())
            console.log("delayed")
            this.setCompleted(x.status)
            this.jobWorker?.decrement()
        }).catch((ex) => {
            this.setFailed(ex.message)
        })
    }    
}