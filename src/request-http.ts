import { HTTPBody, HTTPNoBody, MethodHTTPBody, MethodHTTPNoBody } from "@fastify-modular/route"
import { pito } from "pito"
import qs from "qs"
import { UnexpectedResponse } from "./errors.js"
import { GenericState } from "./generic-state.js"
import { HTTPBodyArgs, HTTPNoBodyArgs, Requester } from "./index.js"
import { jwtBearer } from "./known-presets.js"
import { Result } from "./result.js"

export async function requestHTTPNoBody(
    req: Requester,
    api: HTTPNoBody<string, any, MethodHTTPNoBody, string, any, any, any>,
    args: HTTPNoBodyArgs<GenericState, any, any, any>,
): Promise<Result<any, any>> {
    // =============================================
    // 
    const usingFetch = args.fetch ?? fetch
    if (usingFetch === undefined) {
        throw new Error(`no default fetch function, use {fetch : [your custom fetch function]}`)
    }
    // =============================================
    // setup host, path, url, qs
    const host = req.host.resolve(api)
    const path = req.path.resolve(api.path, api.params, args.params)
    const url = new URL(`${host}${path}`)
    url.search = qs.stringify(pito.wrap(api.query, args.query))
    // =============================================
    // setup headers
    const headers = new Headers(args.option?.headers)
    jwtBearer(api, args, (token) => { headers.set('authorization', `bearer ${token}`) })
    // =============================================
    // fetch option
    const fetchOption: RequestInit = {
        ...(args.option ?? {}),
        method: api.method,
        headers
    }
    return usingFetch(url, fetchOption).then(async (res) => {
        await args.onResponse?.(res)
        const contentType = res.headers.get('content-type') ?? res.headers.get('Content-Type') ?? res.headers.get('CONTENT-TYPE') ?? ''
        if (res.status === 204) {
            return {
                result: 'ok',
                value: pito.unwrap(api.response, undefined),
            }
        } else if (res.status === 200) {
            if (!contentType.startsWith("application/json")) {
                throw new Error(`unexpected not json result, ${contentType}, response : ${res}`)
            }
            return {
                result: 'ok',
                value: pito.unwrap(api.response, await res.json()),
            }
        } else if (res.status === 406) {
            return {
                result: 'fail',
                value: pito.unwrap(api.fail, await res.json()),
            }
        } else {
            throw new UnexpectedResponse(res)
        }
    })
}

export async function requestHTTPBody(
    req: Requester,
    api: HTTPBody<string, any, MethodHTTPBody, any, any, any, any, any>,
    args: HTTPBodyArgs<GenericState, any, any, any, any>,
): Promise<Result<any, any>> {
    // =============================================
    // 
    const usingFetch = args.fetch ?? fetch
    if (usingFetch === undefined) {
        throw new Error(`no default fetch function, use {fetch : [your custom fetch function]}`)
    }
    // =============================================
    // setup host, path, url, qs
    const host = req.host.resolve(api)
    const path = req.path.resolve(api.path, api.params, args.params)
    const url = new URL(`${host}${path}`)
    url.search = qs.stringify(pito.wrap(api.query, args.query))
    // =============================================
    // setup headers
    const headers = new Headers(args.option?.headers)
    headers.set('content-type', 'application/json')
    jwtBearer(api, args, (token) => { headers.set('authorization', `bearer ${token}`) })
    // =============================================
    // fetch option
    const fetchOption: RequestInit = {
        ...(args.option ?? {}),
        method: api.method,
        headers,
        body: args.body === undefined ? 'null' : JSON.stringify(pito.wrap(api.body, args.body))
    }
    return usingFetch(url, fetchOption).then(async (res) => {
        await args.onResponse?.(res)
        const contentType = res.headers.get('content-type') ?? res.headers.get('Content-Type') ?? res.headers.get('CONTENT-TYPE') ?? ''
        if (res.status === 204) {
            return {
                result: 'ok',
                value: pito.unwrap(api.response, undefined),
            }
        } else if (res.status === 200) {
            if (!contentType.startsWith("application/json")) {
                throw new Error(`unexpected not json result, ${contentType}, response : ${res}`)
            }
            return {
                result: 'ok',
                value: pito.unwrap(api.response, await res.json()),
            }
        } else if (res.status === 406) {
            return {
                result: 'fail',
                value: pito.unwrap(api.fail, await res.json()),
            }
        } else {
            throw new UnexpectedResponse(res)
        }
    })
}