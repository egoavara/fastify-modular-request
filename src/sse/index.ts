import EventEmitter from "events"
import { ReadableStreamDefaultReadResult } from "stream/web"
import { AlreadyFetched, MaximumRetryReached, NoFetchAPI, UnexpectedResponse } from "../errors"
// 
const NewLine = 10, CarriageReturn = 13, Space = 32, Colon = 58
const DEFAULT_MAX_RETRY = 10
// 
export interface SSEMessage {
    event?: string
    data?: string
}

export type SSEHandler = {
    onMessage?: (this: SSEController, payload: string) => void | Promise<void>
    onEvent?: (this: SSEController, eventname: string, payload?: string) => void | Promise<void>
    onRetry?: (this: SSEController) => void | Promise<void>
    onOpen?: (this: SSEController) => void | Promise<void>
    onClose?: (this: SSEController, closer: 'server' | 'client' | 'retry') => void | Promise<void>
    onOpenFail?: (this: SSEController, response: Response) => (true | void) | Promise<(true | void)>
}

export interface ISSEController {
    on(eventName: 'message', listener: (payload: string) => void): this;
    on(eventName: 'event', listener: (eventname: string, payload?: string) => void): this;
    on(eventName: 'retry', listener: () => void): this;
    on(eventName: 'open', listener: () => void): this;
    on(eventName: 'close', listener: (closer: 'server' | 'client' | 'retry') => void): this;
}

type SSEParserContext = {
    buffer: Uint8Array
    position: number
    fieldLength: number
    discardTrailingNewline: boolean
    closeLock: Promise<void>
    reader: ReadableStreamDefaultReader<Uint8Array>
}
export type SSEControllerInit =
    & Omit<RequestInit, 'method' | 'body' | 'redirect'>
    & {
        fetch?: typeof fetch
        maxRetry?: number
    }
export class SSEController extends EventEmitter implements ISSEController {
    #isFetched: boolean
    #usingFetch: typeof fetch
    #url: RequestInfo | URL
    #ac: AbortController
    #currentState: 'pending' | 'opening' | 'opened' | 'retry' | 'closing' | 'closed'
    // 
    init: Required<Pick<RequestInit, 'method' | 'signal'>> & Record<'headers', Headers> & SSEControllerInit
    get currentState(): 'pending' | 'opening' | 'opened' | 'retry' | 'closing' | 'closed' { return this.#currentState }
    get lastSendId(): string { return this.init.headers.get('last-send-id') as string }
    set lastSendId(value: string) { this.init.headers.set('last-send-id', value) }
    retry: number

    constructor(url: RequestInfo | URL, init?: SSEControllerInit) {
        super()
        const usingFetch = init?.fetch ?? fetch
        if (usingFetch === undefined) {
            throw new NoFetchAPI()
        }
        // 
        const ac = new AbortController()
        if (init?.signal?.aborted) { ac.abort(init.signal.reason) }
        init?.signal?.addEventListener?.("abort", function () { ac.abort(this.reason) }, { once: true })
        // 
        this.#ac = ac
        this.#usingFetch = usingFetch
        this.#url = url
        this.init = {
            ...(init ?? {}),
            method: "GET",
            headers: new Headers(init?.headers),
            signal: ac.signal,
        }
        this.#isFetched = false
        this.#currentState = 'pending'
        this.retry = 3000
        // 
        this.init.headers.set('last-send-id', '')
    }

    async fetch(handler?: SSEHandler) {
        // lock only once
        if (this.#isFetched) {
            throw new AlreadyFetched()
        }
        this.#isFetched = true
        // 
        const maxRetry = this.init.maxRetry ?? DEFAULT_MAX_RETRY
        let retryCounter = 0
        // 
        const closeLock = new Promise<void>(resolve => this.#ac.signal.addEventListener("abort", () => resolve(), { once: true }))
        // retry loop
        while (true) {
            // opening
            this.#currentState = 'opening'
            const response = await Promise.race([
                this.#usingFetch(this.#url, this.init),
                closeLock
            ])
            if (response === undefined) {
                this.#currentState = 'closed'
                await handler?.onClose?.call(this, 'client')
                this.emit('close', 'client')
                return
            }
            if (response.status === 204) {
                // response close
                // sse spec say, status code 204, make sse close
                this.#ac.abort(null)
                this.#currentState = 'closed'
                await handler?.onClose?.call(this, 'server')
                this.emit('close', 'server')
                return
            }
            if (response.status !== 200) {
                retryCounter++
                if (retryCounter > maxRetry) {
                    throw new MaximumRetryReached(retryCounter)
                }
                if (await handler?.onOpenFail?.call(this, response) === true) {
                    continue
                }
                throw new UnexpectedResponse(response)
            }
            retryCounter = 0
            // opened
            this.#currentState = 'opened'
            await handler?.onOpen?.call(this)
            this.emit('open')
            // message loop 
            const messageLoop = await this.#messageLoop({
                closeLock,
                buffer: new Uint8Array(0),
                fieldLength: -1,
                position: 0,
                discardTrailingNewline: false,
                reader: response.body?.getReader()!,
            }, handler)
            if (this.lastSendId === ':CLOSE:') {
                this.#ac.abort(null)
                this.#currentState = 'closed'
                await handler?.onClose?.call(this, 'server')
                this.emit('close', 'server')
                return
            }
            if (messageLoop === undefined) {
                this.#currentState = 'closed'
                await handler?.onClose?.call(this, 'client')
                this.emit('close', 'client')
                return
            }
            await handler?.onClose?.call(this, 'retry')
            this.emit('close', 'retry')
            // retry
            this.#currentState = 'retry'
            const retryAwait = await Promise.race([
                new Promise<boolean>(resolve => setTimeout(() => resolve(true), this.retry)),
                closeLock,
            ])
            if (retryAwait === undefined) {
                this.#currentState = 'closed'
                await handler?.onClose?.call(this, 'client')
                this.emit('close', 'client')
                return
            }
            await handler?.onRetry?.call(this)
            this.emit('retry')
        }
    }

    async #messageLoop({ buffer, closeLock, discardTrailingNewline, fieldLength, position, reader }: SSEParserContext, handler?: SSEHandler) {
        const decoder = new TextDecoder()
        let message: SSEMessage = {}
        let result: ReadableStreamDefaultReadResult<Uint8Array>
        while (!(result = await reader.read()).done) {
            // concat buffer
            const oldBuffer = buffer
            buffer = new Uint8Array(oldBuffer.length + result.value.length)
            buffer.set(oldBuffer, 0)
            buffer.set(result.value, oldBuffer.length)
            // 
            let lineStart = 0
            while (position < buffer.length) {
                if (discardTrailingNewline) {
                    if (buffer[position] === NewLine) {
                        lineStart = ++position
                    }
                    discardTrailingNewline = false
                }

                let lineEnd = -1
                for (; position < buffer.length && lineEnd === -1; ++position) {
                    switch (buffer[position]) {
                        case Colon:
                            if (fieldLength === -1) { // first colon in line
                                fieldLength = position - lineStart
                            }
                            break
                        case CarriageReturn:
                            discardTrailingNewline = true
                        case NewLine:
                            lineEnd = position
                            break
                    }
                }

                if (lineEnd === -1) {
                    break
                }
                // =========
                // each line works
                const line = buffer.subarray(lineStart, lineEnd)
                if (line.length === 0) {
                    if (message.event !== undefined) {
                        await handler?.onEvent?.call(this, message.event, message.data)
                        this.emit('event', message.event, message.data)
                    } else if (message.data !== undefined) {
                        await handler?.onMessage?.call(this, message.data)
                        this.emit('message', message.data)
                    }
                    message = {}
                } else if (fieldLength > 0) {
                    const field = decoder.decode(line.subarray(0, fieldLength))
                    const valueOffset = fieldLength + (line[fieldLength + 1] === Space ? 2 : 1)
                    const value = decoder.decode(line.subarray(valueOffset))
                    switch (field) {
                        case 'data':
                            message.data = message.data !== undefined
                                ? message.data + '\n' + value
                                : value
                            break
                        case 'event':
                            message.event = value
                            break
                        case 'id':
                            if (value !== undefined && this.lastSendId !== value) {
                                this.lastSendId = value
                            }
                            if (this.lastSendId === ":CLOSE:") {
                                return
                            }
                            break
                        case 'retry':
                            const retry = parseInt(value, 10)
                            if (!isNaN(retry)) {
                                // ignore non-integers
                                this.retry = retry
                            }
                            break
                    }
                }
                // =========
                // each line works
                lineStart = position
                fieldLength = -1
            }
            if (lineStart === buffer.length) {
                buffer = new Uint8Array(0)
                lineStart = 0
                fieldLength = -1
            } else if (lineStart !== 0) {
                buffer = buffer.subarray(lineStart)
                position -= lineStart
            }
        }
        return true
    }

    close(err?: Error) {
        this.#currentState = 'closing'
        this.#ac.abort(err ?? null)
    }
}