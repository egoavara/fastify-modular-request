export class TimeoutError extends Error {
    expireDuration: number
    expiredAt: Date
    constructor(expireDuration: number, expiredAt: Date) {
        super(`expired ${expireDuration}ms, expired at ${expiredAt}`)
        this.expireDuration = expireDuration
        this.expiredAt = expiredAt
    }
}