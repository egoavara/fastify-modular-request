import EventSource from "both-sse"
import { SSE } from "fastify-modular-route"
import qs from "qs"
import { AbortError, TimeoutError } from "./errors.js"
import { GenericState } from "./generic-state.js"
import { Requester, SSEArgs } from "./index.js"
import { jwtBearer } from "./known-presets.js"
import { Result } from "./result.js"

const DEFAULT_TIMEOUT_MS = 6000
const DEFAULT_MAX_BUFFER = 100

export type SSEManager<Packet, Fail> = {
    source: EventSource,
    [Symbol.asyncIterator]: () => AsyncIterator<Result<Packet, Fail>>,
    iter(): AsyncIterator<Result<Packet, Fail>>,
    next(): Promise<Result<Packet, Fail> | undefined>,

    forawait(
        onEach: (packet: Packet) => void,
        option?: {
            onFail?: (fail: Fail) => void,
            onCatch?: (err: any) => void,
        }
    ): Promise<void>
    close(error?: any): void,
}

export async function requestSSE(
    req: Requester,
    api: SSE<string, string, any, any, any, any>,
    args: SSEArgs<GenericState, any, any, any>,
): Promise<SSEManager<any, any>> {
    // =============================================
    const ac = new AbortController()
    const timeout = args.sse?.timeout ?? DEFAULT_TIMEOUT_MS
    const maxBuffer = args.sse?.maxBuffer ?? DEFAULT_MAX_BUFFER
    const signal = ac.signal
    // =============================================
    // setup host, path, url, headers
    const host = req.host.resolve(api)
    const path = req.path.resolve(api.path, api.params, args.params)
    const url = new URL(`${host}${path}`)
    const headers: Record<string, string | number | boolean> = {}
    // setup qs, jwtBearer
    url.search = qs.stringify(args.query)
    jwtBearer(api, args, (token) => { headers['authorization'] = `bearer ${token}` })
    //
    return new Promise((resolve, reject) => {
        const source = new EventSource(
            url.toString(),
            {
                headers: Object.fromEntries(Object.entries(headers).map(([k, v]) => ([k, v.toString()]))),
            }
        )
        // eventsource to SSEManager
        let buffer: Result<any, any>[] = []
        let unlock: undefined | (() => void) = undefined
        // 
        const timeoutHndl = setTimeout(() => { 
            ac.abort()
            reject(new TimeoutError(timeout, new Date())) 
        }, timeout)
        signal.addEventListener('abort', () => {
            if (unlock !== undefined) {
                unlock()
                unlock = undefined
            }
            if(source.readyState !== EventSource.CLOSED){
                source.close()
            }
        })
        // on message handler
        source.onmessage = (event) => {
            const data = JSON.parse(event.data.toString())
            switch (data.message) {
                case 'packet':
                    buffer.push({
                        result: 'ok',
                        value: data.payload
                    })
                    if (unlock !== undefined) {
                        unlock()
                        unlock = undefined
                    }
                    if (buffer.length > maxBuffer) {
                        buffer.shift()
                    }
                    break
                case 'fail':
                    buffer.push({
                        result: 'fail',
                        value: data.cause
                    })
                    if (unlock !== undefined) {
                        unlock()
                        unlock = undefined
                    }
                    break
                case 'throw':
                    ac.abort(data.error)
                    break
                case 'close':
                    ac.abort(null)
                    break
            }
        }
        //
        const aiter: AsyncIterator<Result<any, any>, void> = {
            async next() {
                if (buffer.length > 0) {
                    return {
                        value: buffer.shift()!!
                    }
                }
                if (signal.aborted) {
                    if (signal.reason !== null) {
                        throw signal.reason
                    }
                    return {
                        done: true,
                        value: undefined,
                    }
                }
                await (new Promise<void>(resolve => unlock = resolve))
                if (signal.aborted) {
                    if (signal.reason !== null) {
                        throw signal.reason
                    }
                    return {
                        done: true,
                        value: undefined,
                    }
                }
                if (buffer.length > 0) {
                    return {
                        value: buffer.shift()!!
                    }
                }
                throw new Error(`unreachable`)
            }
        }
        // 
        source.onopen = () => {
            clearTimeout(timeoutHndl)

            resolve({
                source,
                [Symbol.asyncIterator]: () => aiter,
                iter() { return aiter },
                next() {
                    return aiter.next().then(v => {
                        if (v.done) {
                            return undefined
                        }
                        return v.value
                    })
                },
                async forawait(onEach, option?) {
                    const onCatch = option?.onCatch ?? ((err: any) => { })
                    const onFail = option?.onFail ?? ((fail: any) => { })
                    try {
                        let temp = await aiter.next()
                        while (temp.done !== true) {
                            if (temp.value.result === 'ok') {
                                onEach(temp.value.value)
                            } else {
                                onFail(temp.value.value)
                            }
                            temp = await aiter.next()
                        }
                    } catch (e) {
                        console.log('error')
                        console.log(e)
                        console.log(e instanceof AbortError)
                        if (!(e instanceof AbortError)) {
                            onCatch(e)
                            throw e
                        }
                    }
                },
                close: (reason?: any) => {
                    ac.abort(reason)
                },
            })
        }
    })
}
