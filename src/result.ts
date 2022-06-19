export type Result<Ok, Fail> =
    | {
        result: 'ok'
        value: Ok
    }
    | {
        result: 'fail',
        value: Fail
    }
export namespace Result {
    export async function handle<Ok, Fail>(value: Result<Ok, Fail> | PromiseLike<Result<Ok, Fail>>, option: { ok?: (ok: Ok) => void, fail?: (fail: Fail) => void }) {
        const temp = await value
        if (temp.result === 'ok') {
            if (option.ok !== undefined) {
                option.ok(temp.value)
            }
        } else {
            if (option.fail !== undefined) {
                option.fail(temp.value)
            }
        }
    }
}

export type PResult<Ok, Fail> = Promise<Result<Ok, Fail>> & {
    ok(): Promise<Ok>
    ok(handler: (ok: Ok) => void): PResult<Ok, Fail>

    fail(): Promise<Fail>
    fail(handler: (fail: Fail) => void): PResult<Ok, Fail>
}
export function PResult<Ok, Fail>(wrap: Promise<Result<Ok, Fail>>): PResult<Ok, Fail> {
    return Object.create(wrap, {
        ok: {
            value: function (handler?: (ok: Ok) => void) {
                if (handler === undefined) {
                    return this.then((result: Result<Ok, Fail>) => {
                        if (result.result === 'ok') {
                            return result.value
                        } else {
                            throw result.value
                        }
                    })
                }
                return PResult(this.then((result: Result<Ok, Fail>) => {
                    if (result.result === 'ok') {
                        handler(result.value)
                    }
                    return result
                }))
            }
        },
        fail: {
            value: function (handler?: (fail: Fail) => void) {
                if (handler === undefined) {
                    return this.then((result: Result<Ok, Fail>) => {
                        if (result.result === 'fail') {
                            return result.value
                        } else {
                            throw result.value
                        }
                    })
                }
                return PResult(this.then((result: Result<Ok, Fail>) => {
                    if (result.result === 'fail') {
                        handler(result.value)
                    }
                    return result
                }))
            }
        }
    })
}