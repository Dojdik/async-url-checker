import { JobWorker } from "@/processor/JobWorker"
import { JobUrl } from "./JobUrl"
import cluster from "cluster"

let jobIdIncrement = 1

export class Job {
    id: number
    createdAt: Date
    updatedAt: Date
    status: "pending" | "in_progress" | "completed" | "cancelled" | "failed"
    urls: JobUrl[]

    constructor(urls: string[]) {
        this.id = jobIdIncrement++
        this.createdAt = new Date()
        this.updatedAt = this.createdAt
        this.status = "pending"
        this.urls = urls.map(x => new JobUrl(x))
    }

    start() {
        const worker = cluster.fork()
        worker.on('message', (message) => {
            if (message == "ready") {
                worker.send(this)
                console.log('sent 1')
            } else {
                
            }
        })
    }
}