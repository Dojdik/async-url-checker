let jobIdIncrement = 1

export class Job {
    id: number
    createdAt: Date
    updatedAt: Date
    status: "pending" | "in_progress" | "completed" | "cancelled" | "failed"
    urls: string[]

    constructor(urls: string[]) {
        this.id = jobIdIncrement++
        this.createdAt = new Date()
        this.updatedAt = this.createdAt
        this.status = "pending"
        this.urls = urls
    }
}