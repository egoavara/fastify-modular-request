export class TimeoutError extends Error {
    expireDuration: number
    expiredAt: Date
    constructor(expireDuration: number, expiredAt: Date) {
        super(`expired ${expireDuration}ms, expired at ${expiredAt}`)
        this.expireDuration = expireDuration
        this.expiredAt = expiredAt
    }
}

export class AbortError extends Error {
    constructor() { super(`abort error`) }
}
export class UnexpectedStatus extends Error {
    status: number
    constructor(status: number) {
        super(`unexpected status code, ${status}`)
        this.status = status
    }
}