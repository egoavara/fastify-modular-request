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
export class MaxBufferReached extends Error {
    constructor() { super(`abort error`) }
}
export class UnexpectedResponse extends Error {
    response: Response
    constructor(response: Response) {
        super(`unexpected response, status=${response.status}`)
        this.response = response
    }
}
export class MaximumRetryReached extends Error {
    max: number
    constructor(max: number) {
        super(`maximum retry ${max}`)
        this.max = max
    }
}
export class NoFetchAPI extends Error {
    constructor() {
        super(`there is no fetch api`)
    }
}
export class AlreadyFetched extends Error {
    constructor() {
        super(`already .fetch called`)
    }
}