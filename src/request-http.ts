// http manager using axios as requester

import axios from "axios"
import { pito } from "pito"
import { HTTPBody, HTTPNoBody, MethodHTTPBody, MethodHTTPNoBody } from "fastify-modular-route"
import { HTTPBodyArgs, HTTPNoBodyArgs, Requester } from "./index.js"
import { jwtBearer } from "./known-presets.js"
import QueryString from "qs"

export async function requestHTTPNoBody(
    req: Requester,
    api: HTTPNoBody<string, MethodHTTPNoBody, string, any, any, any, any>,
    args: HTTPNoBodyArgs<any, any, any>,
): Promise<any> {
    // setup host
    const host = req.host.resolve(api)
    // setup path
    const path = req.path.resolve(api.path, api.params, args.params)
    // setup headers
    const headers: Record<string, string | number | boolean> = {}
    jwtBearer(api, args, (token) => { headers['authorization'] = `bearer ${token}` })

    return axios.request({
        ...(args.axios ?? {}),
        method: api.method,
        url: `${host}${path}`,
        params: pito.wrap(api.query, args.query ?? {}),
        headers: headers,
        paramsSerializer: QueryString.stringify,
    }).then(v => {
        const contentType = v.headers['content-type'] ?? v.headers['Content-Type'] ?? v.headers['CONTENT-TYPE'] ?? ''
        if (!contentType.startsWith("application/json")) {
            throw new Error(`unexpected not json result, ${contentType}, response : ${v}`)
        }
        return v.data
    })
}

export async function requestHTTPBody(
    req: Requester,
    api: HTTPBody<string, MethodHTTPBody, string, any, any, any, any, any>,
    args: HTTPBodyArgs<any, any, any, any>,
): Promise<any> {
    // setup host
    const host = req.host.resolve(api)
    // setup path
    const path = req.path.resolve(api.path, api.params, args.params)
    // setup headers
    const headers: Record<string, string | number | boolean> = {}
    jwtBearer(api, args, (token) => { headers['authorization'] = `bearer ${token}` })

    return axios.request({
        ...(args.axios ?? {}),
        method: api.method,
        url: `${host}${path}`,
        params: pito.wrap(api.query, args.query ?? {}),
        ...(args.body !== undefined ? { data: pito.wrap(api.body, args.body), } : {}),
        headers: headers,
        paramsSerializer: QueryString.stringify,
    }).then(v => {
        const contentType = v.headers['content-type'] ?? v.headers['Content-Type'] ?? v.headers['CONTENT-TYPE'] ?? ''
        if (!contentType.startsWith("application/json")) {
            throw new Error(`unexpected not json result, ${contentType}, response : ${v}`)
        }
        return v.data
    }).catch(v=>{
        
    })
}