import {
    AxiosRequestConfig
} from "axios"
import { HTTPBody, HTTPNoBody, InferPrefix, MethodHTTPBody, MethodHTTPNoBody, Multipart, Route, SSE, WS } from "fastify-modular-route"
import { pito } from "pito"
import { GenericState } from "./generic-state.js"
import { KnownPresetSnippet } from "./known-presets.js"
import { ManagerHost } from "./manager-host.js"
import { ManagerPath } from "./manager-path.js"
import { requestHTTPBody, requestHTTPNoBody } from "./request-http.js"
import { MultipartFile, requestMultipart } from "./request-multipart.js"
import { requestSSE, SSEManager } from "./request-sse.js"
import { requestWS, WSManager } from "./request-ws.js"
import { BodySnippet, IsOverlap, ParamsSnippet, QuerySnippet } from "./utils.js"



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


export type SSEArgs<State extends GenericState, Params, Query, Preset> =
    & ParamsSnippet<Params>
    & QuerySnippet<Query>
    & KnownPresetSnippet<Preset, State>

export type WSArgs<State extends GenericState, Params, Query, Preset> =
    & ParamsSnippet<Params>
    & QuerySnippet<Query>
    & KnownPresetSnippet<Preset, State>

export type RequestArgs<State extends GenericState, API extends Route> =
    API extends HTTPBody<any, MethodHTTPBody, any, infer Params, infer Query, infer Body, any, infer Preset>
    ? HTTPBodyArgs<State, pito.Type<Params>, pito.Type<Query>, pito.Type<Body>, Preset>
    : API extends HTTPNoBody<any, MethodHTTPNoBody, any, infer Params, infer Query, any, infer Preset>
    ? HTTPNoBodyArgs<State, pito.Type<Params>, pito.Type<Query>, Preset>
    : API extends Multipart<any, any, infer Params, infer Query, any, infer Preset>
    ? MultipartArgs<State, pito.Type<Params>, pito.Type<Query>, Preset>
    : API extends SSE<any, any, infer Params, infer Query, any, infer Preset>
    ? SSEArgs<State, pito.Type<Params>, pito.Type<Query>, Preset>
    : API extends WS<any, any, infer Params, infer Query, any, any, any, any, infer Preset>
    ? WSArgs<State, pito.Type<Params>, pito.Type<Query>, Preset>
    : never


export type RequestRet<API extends Route> =
    API extends HTTPBody<string, MethodHTTPBody, any, any, any, any, infer Response, any>
    ? pito.Type<Response>
    : API extends HTTPNoBody<string, MethodHTTPNoBody, any, any, any, infer Response, any>
    ? pito.Type<Response>
    : API extends Multipart<string, string, any, any, infer Response, any>
    ? pito.Type<Response>
    : API extends SSE<string, string, any, any, infer Packet, any>
    ? SSEManager<pito.Type<Packet>>
    : API extends WS<string, string, any, any, infer Send, infer Recv, infer Request, infer Response, any>
    // WS은 서버 기준으로 정의하기에 클라이언트는 Recv, Send, Response, Request를 반대 의미로 써야한다.
    ? WSManager<pito.Type<Recv>, pito.Type<Send>, Response, Request>
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
    async request<API extends Route>(api: API, others: RequestArgs<{ ManagedAuth: false }, API>): Promise<RequestRet<API>> {
        switch (api.method) {
            case 'HEAD':
            case 'GET':
                return requestHTTPNoBody(this, api, others as any)
            case 'POST':
            case 'PUT':
            case 'PATCH':
            case 'DELETE':
                return requestHTTPBody(this, api, others as any)
            case 'MULTIPART':
                return requestMultipart(this, api, others as any)
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
    async request<API extends Route>(
        api: API,
        others: RequestArgs<{ ManagedAuth: true }, API>
    ): Promise<RequestRet<API>> {
        if (api.presets.includes('jwt-bearer')) {
            others['auth'] = await this.onTokenNeed(this.req)
        }
        return this.req.request(api, others as unknown as RequestArgs<{ ManagedAuth: false }, API>)
            .catch(async err => {
                // this.onTokenExpired(this.req)
                console.log(err)
                throw new Error(`todo`)
            })
    }
}
