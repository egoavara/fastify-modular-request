import { SSE } from "@fastify-modular/route"
import { pito } from "pito"
import qs from "qs"
import { GenericState } from "./generic-state.js"
import { Requester, SSEArgs } from "./index.js"
import { jwtBearer } from "./known-presets.js"
import { SSEController } from "./sse/index.js"
export type SSEHandler<Packet, Event extends Record<string, any>, Fail> = {
    onMessage?: (payload: Packet) => void | Promise<void>
    onEvent?: { [_ in keyof Event]: (payload: Event[_]) => void | Promise<void> }
    onFail?: (payload: Fail) => void | Promise<void>
    onRetry?: () => void | Promise<void>
    onOpen?: () => void | Promise<void>
    onClose?: (closer: 'server' | 'client' | 'retry') => void | Promise<void>
    onOpenFail?: (this: SSEController, response: Response) => (true | void) | Promise<(true | void)>
}
export type SSEManager<Packet, Event extends Record<string, any>, Fail> = {
    controller: SSEController,
    defaultHandler:SSEHandler<Packet, Event, Fail>,
    // 
    fetch(handler: SSEHandler<Packet, Event, Fail>): Promise<void>
    close(error?: any): void
}

export async function requestSSE(
    req: Requester,
    api: SSE<string, string, any, any, any, any>,
    args: SSEArgs<GenericState, any, any, any>,
    defaultHandler:SSEHandler<any, any, any>,
): Promise<SSEManager<any, any, any>> {
    // =============================================
    // setup host, path, url, qs
    const host = req.host.resolve(api)
    const path = req.path.resolve(api.path, api.params, args.params)
    const url = new URL(`${host}${path}`)
    url.search = qs.stringify(pito.wrap(api.query, args.query))
    const headers = new Headers(args.fetcher?.headers)
    // =============================================
    // setup jwtBearer
    jwtBearer(api, args, (token) => { headers.set('authorization', `bearer ${token}`) })
    // =============================================
    // return new SSEController(url, {
    //     ...(args.fetch ?? {}),
    //     method: "GET",
    //     headers,
    // }).fetch()
    const controller = new SSEController(url, { ...args.fetcher, headers })
    return {
        controller,
        defaultHandler,
        async fetch(handler) {
            return controller.fetch({
                onOpen:async () => {
                    await defaultHandler?.onOpen?.()
                    await handler?.onOpen?.()
                },
                onClose:async (closer) => {
                    await defaultHandler?.onClose?.(closer)
                    await handler?.onClose?.(closer)
                },
                onRetry: async () => {
                    await defaultHandler?.onRetry?.()
                    await handler?.onRetry?.()
                },
                onMessage: async (payload) => {
                    const jsonPayload = JSON.parse(payload)
                    await defaultHandler?.onMessage?.(pito.unwrap(api.packet, jsonPayload))
                    await handler?.onMessage?.(pito.unwrap(api.packet, jsonPayload))
                },
                onEvent: async (eventname, payload?) => {
                    const handlerEvent = handler?.onEvent?.[eventname]
                    const defaultHandlerEvent = defaultHandler?.onEvent?.[eventname]
                    const jsonPayload = payload !== undefined ? JSON.parse(payload) : undefined
                    await defaultHandlerEvent?.(pito.unwrap(api.packet, jsonPayload))
                    await handlerEvent?.(pito.unwrap(api.packet, jsonPayload))
                },
                onOpenFail: async function (response) {
                    await defaultHandler?.onOpenFail?.call(this, response)
                    await handler?.onOpenFail?.call(this, response)
                },
            })
        },
        close(error?) {
            controller.close(error)
        },
    }
    //
}
