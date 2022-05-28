import EventSource from "both-sse"
import { SSE } from "fastify-modular-route"
import qs from "qs"
import { TimeoutError } from "./errors.js"
import { GenericState } from "./generic-state.js"
import { Requester, SSEArgs } from "./index.js"
import { jwtBearer } from "./known-presets.js"

const DEFAULT_TIMEOUT_MS = 6000

export type SSEManager<Packet> = {
    source: EventSource,
    [Symbol.asyncIterator]: () => AsyncIterator<Packet, void>,
    iter(): AsyncIterator<Packet, void>,
    next(): Promise<Packet | undefined>,
    forawait(onEach: (duration: number) => void): Promise<void>
    forawait(onEach: (duration: number) => void, onClose?: () => void): void
    close(error?: any): void,
}

export async function requestSSE(
    req: Requester,
    api: SSE<string, string, any, any, any, any>,
    args: SSEArgs<GenericState, any, any, any>,
): Promise<SSEManager<any>> {
    // =============================================
    const timeout = args.sse?.timeout ?? DEFAULT_TIMEOUT_MS
    // =============================================
    // setup host
    const host = req.host.resolve(api)
    // setup path
    const path = req.path.resolve(api.path, api.params, args.params)
    // setup headers
    const headers: Record<string, string | number | boolean> = {}
    jwtBearer(api, args, (token) => { headers['authorization'] = `bearer ${token}` })
    // setup url
    const url = new URL(`${host}${path}`)
    url.search = qs.stringify(args.query)
    // setup eventsource
    const sseUrl = url.toString()
    const sseInit = { headers: Object.fromEntries(Object.entries(headers).map(([k, v]) => ([k, v.toString()]))) }
    return new Promise((resolve, reject) => {
        const source = new EventSource(sseUrl, sseInit)
        // eventsource to SSEManager
        let unlock: ((data: any[]) => void) | undefined = undefined
        let buffer: any[] = []
        let loopDone = false
        let err: any = undefined
        const close = (error?: any) => {
            loopDone = true
            source.close()
            if (unlock !== undefined) {
                unlock(buffer)
                buffer = []
            }
            if (error !== undefined) {
                err = error
            }
        }
        // 
        setTimeout(() => {
            close()
            reject(new TimeoutError(timeout, new Date()))
        }, timeout)
        // on message handler
        source.onmessage = (event) => {
            const data = JSON.parse(event.data.toString())
            switch (data.message) {
                case 'packet':
                    buffer.push(data.payload)
                    if (unlock !== undefined) {
                        unlock(buffer)
                        buffer = []
                        unlock = undefined
                    }
                    break
                case 'throw':
                    close(data.error)
                    break
                case 'close':
                    close()
                    break
            }
        }
        // 
        const iterator = (async function* () {
            let blocker = new Promise<any[]>(resolve => unlock = resolve)
            while (!loopDone) {
                yield* await blocker
                if (loopDone) {
                    break
                }
                blocker = new Promise<any[]>(resolve => unlock = resolve)
            }
            if (err !== undefined) {
                throw err
            }
            yield* buffer
            return
        })()
        // 
        let blockIterator: any = undefined
        source.onopen = () => {
            resolve({
                source,
                [Symbol.asyncIterator]: () => {
                    if (blockIterator !== undefined) {
                        throw blockIterator
                    }
                    return iterator
                },
                iter() {
                    if (blockIterator !== undefined) {
                        throw blockIterator
                    }
                    return iterator
                },
                next() {
                    if (blockIterator !== undefined) {
                        throw blockIterator
                    }
                    return iterator.next().then(v => {
                        if (v.done) {
                            return undefined
                        }
                        return v.value
                    })
                },
                // @ts-expect-error
                forawait(onEach, onClose) {
                    blockIterator = new Error(`forawait called, forawait take async iterator`)
                    if (typeof onClose === 'undefined') {
                        return new Promise<void>(resolve => {
                            (async () => {
                                for await (const duration of iterator) {
                                    onEach(duration)
                                }
                            })().then(_ => {
                                resolve()
                            })
                        }) as any
                    }
                    (async () => {
                        for await (const duration of iterator) {
                            onEach(duration)
                        }
                    })().then(_ => {
                        if (onClose !== undefined) {
                            onClose()
                        }
                    })
                },
                close,
            })
        }
    })
}
