import {
    AxiosError,
    AxiosRequestConfig
} from "axios"
import { HTTPBody, HTTPNoBody, MethodHTTPBody, MethodHTTPNoBody, Multipart, Route, SSE, WS } from "fastify-modular-route"
import { pito } from "pito"
import { GenericState } from "./generic-state.js"
import { KnownPresetSnippet } from "./known-presets.js"
import { ManagerHost } from "./manager-host.js"
import { ManagerPath } from "./manager-path.js"
import { requestHTTPBody, requestHTTPNoBody } from "./request-http.js"
import { MultipartFile, requestMultipart } from "./request-multipart.js"
import { requestSSE, SSEManager } from "./request-sse.js"
import { requestWS, WSManager } from "./request-ws.js"
import { PResult, Result } from "./result.js"
import { BodySnippet, ParamsSnippet, QuerySnippet } from "./utils.js"



export type HTTPNoBodyArgs<State extends GenericState, Params, Query, Preset> =
    & ParamsSnippet<Params>
    & QuerySnippet<Query>
    & KnownPresetSnippet<Preset, State>
    & { axios?: AxiosRequestConfig }

export type HTTPBodyArgs<State extends GenericState, Params, Query, Body, Preset> =
    & BodySnippet<Body>
    & ParamsSnippet<Params>
    & QuerySnippet<Query>
    & KnownPresetSnippet<Preset, State>
    & { axios?: AxiosRequestConfig }

export type MultipartArgs<State extends GenericState, Params, Query, Preset> =
    & { files: MultipartFile[] }
    & ParamsSnippet<Params>
    & QuerySnippet<Query>
    & KnownPresetSnippet<Preset, State>
    & { axios?: AxiosRequestConfig }

export type SSEOption = {
    timeout?: number // ms
    maxBuffer?: number
}
export type SSEArgs<State extends GenericState, Params, Query, Preset> =
    & { sse?: SSEOption }
    & ParamsSnippet<Params>
    & QuerySnippet<Query>
    & KnownPresetSnippet<Preset, State>

export type WSArgs<State extends GenericState, Params, Query, Preset> =
    & ParamsSnippet<Params>
    & QuerySnippet<Query>
    & KnownPresetSnippet<Preset, State>

export type RequestArgs<State extends GenericState, API extends Route> =
    API extends HTTPBody<any, infer Preset, MethodHTTPBody, any, infer Params, infer Query, infer Body, any, any>
    ? HTTPBodyArgs<State, pito.Type<Params>, pito.Type<Query>, pito.Type<Body>, Preset>
    : API extends HTTPNoBody<any, infer Preset, MethodHTTPNoBody, any, infer Params, infer Query, any, any>
    ? HTTPNoBodyArgs<State, pito.Type<Params>, pito.Type<Query>, Preset>
    : API extends Multipart<any, infer Preset, any, infer Params, infer Query, any, any>
    ? MultipartArgs<State, pito.Type<Params>, pito.Type<Query>, Preset>
    : API extends SSE<any, infer Preset, any, infer Params, infer Query, any, any>
    ? SSEArgs<State, pito.Type<Params>, pito.Type<Query>, Preset>
    : API extends WS<any, infer Preset, any, infer Params, infer Query, any, any, any, any, any>
    ? WSArgs<State, pito.Type<Params>, pito.Type<Query>, Preset>
    : never


export type RequestRet<API extends Route> =
    API extends HTTPBody<string, string, MethodHTTPBody, any, any, any, any, infer Response, infer Fail>
    ? PResult<pito.Type<Response>, pito.Type<Fail>>
    : API extends HTTPNoBody<string, string, MethodHTTPNoBody, any, any, any, infer Response, infer Fail>
    ? PResult<pito.Type<Response>, pito.Type<Fail>>
    : API extends Multipart<string, string, string, any, any, infer Response, infer Fail>
    ? PResult<pito.Type<Response>, pito.Type<Fail>>
    : API extends SSE<string, string, string, any, any, infer Packet, infer Fail>
    ? Promise<SSEManager<pito.Type<Packet>, pito.Type<Fail>>>
    : API extends WS<string, string, string, any, any, infer Send, infer Recv, infer Request, infer Response, infer Fail>
    // WS은 서버 기준으로 정의하기에 클라이언트는 Recv, Send, Response, Request를 반대 의미로 써야한다.
    ? Promise<WSManager<pito.Type<Recv>, pito.Type<Send>, Response, Request, pito.Type<Fail>>>
    : never


export class Requester {
    readonly host: ManagerHost
    readonly path: ManagerPath
    protected constructor(host: ManagerHost, path: ManagerPath) {
        this.host = host
        this.path = path
    }
    /// ==========
    static create(
        defaultHost: string,
        options?: {
            hostMapping?: Record<string, string>
        }
    ): Requester {
        return new Requester(
            ManagerHost.create(defaultHost, options?.hostMapping),
            ManagerPath.create(),
        )
    }

    /// ==========
    request<API extends Route>(api: API, others: RequestArgs<{ ManagedAuth: false }, API>): RequestRet<API> {
        // 쿼리 오브젝트 초기화
        others.query = others.query ?? {}
        // 
        switch (api.method) {
            case 'HEAD':
            case 'GET':
                return PResult(requestHTTPNoBody(this, api, others as any)) as any
            case 'POST':
            case 'PUT':
            case 'PATCH':
            case 'DELETE':
                return PResult(requestHTTPBody(this, api, others as any)) as any
            case 'MULTIPART':
                return PResult(requestMultipart(this, api, others as any)) as any
            case 'SSE':
                return requestSSE(this, api, others as any) as any
            case 'WS':
                return requestWS(this, api, others as any) as any
            default:
                // @ts-ignore
                throw new Error(`unimplemented method = '${api.method}'`)
        }
    }

    jwtManaged(onTokenNeed: (req: Requester) => Promise<string>, onTokenExpired: (req: Requester) => Promise<string>): JWTManagedRequester {
        return new JWTManagedRequester(this, onTokenNeed, onTokenExpired)
    }
}

export class JWTManagedRequester {
    readonly req: Requester
    onTokenNeed: (req: Requester) => Promise<string>
    onTokenExpired: (req: Requester) => Promise<string>
    constructor(req: Requester, onTokenNeed: (req: Requester) => Promise<string>, onTokenExpired: (req: Requester) => Promise<string>) {
        this.req = req
        this.onTokenNeed = onTokenNeed
        this.onTokenExpired = onTokenExpired
    }
    /// ==========
    request<API extends Route>(
        api: API,
        others: RequestArgs<{ ManagedAuth: true }, API>
    ): RequestRet<API> {
        // 쿼리 오브젝트 초기화
        others.query = others.query ?? {}
        // 
        switch (api.method) {
            case 'HEAD':
            case 'GET':
                return PResult((async () => {
                    if (api.presets.includes('jwt-bearer')) {
                        others['auth'] = await this.onTokenNeed(this.req)
                    }
                    try {
                        return await requestHTTPNoBody(this.req, api, others as any)
                    } catch (err) {
                        if (err instanceof AxiosError && err.response?.status === 403) {
                            others['auth'] = await this.onTokenExpired(this.req)
                        }
                        return await requestHTTPNoBody(this.req, api, others as any)
                    }
                })()) as any
            case 'POST':
            case 'PUT':
            case 'PATCH':
            case 'DELETE':
                return PResult((async () => {
                    if (api.presets.includes('jwt-bearer')) {
                        others['auth'] = await this.onTokenNeed(this.req)
                    }
                    try {
                        return await requestHTTPBody(this.req, api, others as any)
                    } catch (err) {
                        if (err instanceof AxiosError && err.response?.status === 403) {
                            others['auth'] = await this.onTokenExpired(this.req)
                        }
                        return await requestHTTPBody(this.req, api, others as any)
                    }
                })()) as any
            case 'MULTIPART':
                return PResult((async () => {
                    if (api.presets.includes('jwt-bearer')) {
                        others['auth'] = await this.onTokenNeed(this.req)
                    }
                    try {
                        return await requestMultipart(this.req, api, others as any)
                    } catch (err) {
                        if (err instanceof AxiosError && err.response?.status === 403) {
                            others['auth'] = await this.onTokenExpired(this.req)
                        }
                        return await requestMultipart(this.req, api, others as any)
                    }
                })()) as any
            case 'SSE':
                
                return (async () => {
                    if (api.presets.includes('jwt-bearer')) {
                        others['auth'] = await this.onTokenNeed(this.req)
                    }
                    try{
                        return await requestSSE(this.req, api, others as any) as any
                    }catch (err) {
                        if (err instanceof AxiosError && err.response?.status === 403) {
                            others['auth'] = await this.onTokenExpired(this.req)
                        }
                        return await requestSSE(this.req, api, others as any)
                    }
                })() as any
            case 'WS':
                return (async () => {
                    if (api.presets.includes('jwt-bearer')) {
                        others['auth'] = await this.onTokenNeed(this.req)
                    }
                    try{
                        return await requestWS(this.req, api, others as any) as any
                    }catch (err) {
                        if (err instanceof AxiosError && err.response?.status === 403) {
                            others['auth'] = await this.onTokenExpired(this.req)
                        }
                        return await requestWS(this.req, api, others as any)
                    }
                })() as any
            default:
                // @ts-ignore
                throw new Error(`unimplemented method = '${api.method}'`)
        }
    }
}
