import { SSE } from "@fastify-modular/route"
import { pito } from "pito"
import qs from "qs"
import { AbortError, TimeoutError } from "./errors.js"
import { GenericState } from "./generic-state.js"
import { Requester, SSEArgs } from "./index.js"
import { jwtBearer } from "./known-presets.js"
import { Result } from "./result.js"

const DEFAULT_TIMEOUT_MS = 6000
const DEFAULT_MAX_BUFFER = 100
export type SSEManager<Packet, Event extends Record<string, any>, Fail> = {
    response: Response,
    // 
    forawait(
        onEach: (packet: Packet) => void | Promise<void>,
        option?: {
            on?: Partial<{ [_ in keyof Event]: (args: Event[_]) => void | Promise<void> }>
            onRetry?: () => void | Promise<void>,
            onFail?: (fail: Fail) => void | Promise<void>,
            onCatch?: (err: any) => void | Promise<void>,
        }
    ): Promise<void>
    close(error?: any): void
}

export async function requestSSE(
    req: Requester,
    api: SSE<string, string, any, any, any, any>,
    args: SSEArgs<GenericState, any, any, any>,
): Promise<SSEManager<any, any>> {
    // =============================================
    // set header
    const headers = new Headers(args.fetch?.headers)
    // =============================================
    // override signal
    const ac = new AbortController()
    const signal = ac.signal
    args.fetch?.signal?.addEventListener("abort", () => ac.abort())
    // =============================================
    // setup host, path, url, qs
    const host = req.host.resolve(api)
    const path = req.path.resolve(api.path, api.params, args.params)
    const url = new URL(`${host}${path}`)
    url.search = qs.stringify(pito.wrap(api.query, args.query))
    // =============================================
    // setup jwtBearer
    jwtBearer(api, args, (token) => { headers.set('authorization', `bearer ${token}`) })
    // =============================================
    const fetchBody: RequestInit = {
        ...(args.fetch ?? {}),
        method: "GET",
        headers,
        signal : signal
    }
    //
}
