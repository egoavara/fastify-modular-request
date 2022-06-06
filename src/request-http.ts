// http manager using axios as requester

import axios from "axios"
import type { AxiosResponse } from "axios"
import { pito } from "pito"
import { HTTPBody, HTTPNoBody, MethodHTTPBody, MethodHTTPNoBody } from "fastify-modular-route"
import { HTTPBodyArgs, HTTPNoBodyArgs, Requester } from "./index.js"
import { jwtBearer } from "./known-presets.js"
import QueryString from "qs"
import { GenericState } from "./generic-state.js"
import { PResult, Result } from "./result.js"

export async function requestHTTPNoBody(
    req: Requester,
    api: HTTPNoBody<string, any, MethodHTTPNoBody, string, any, any, any>,
    args: HTTPNoBodyArgs<GenericState, any, any, any>,
): Promise<Result<any, any>> {
    // setup host
    const host = req.host.resolve(api)
    // setup path
    const path = req.path.resolve(api.path, api.params, args.params)
    // setup headers
    const headers: Record<string, string | number | boolean> = {}
    jwtBearer(api, args, (token) => { headers['authorization'] = `bearer ${token}` })
    try {
        const res = await axios.request({
            ...(args.axios ?? {}),
            method: api.method,
            url: `${host}${path}`,
            params: pito.wrap(api.query, args.query ?? {}),
            headers: headers,
            paramsSerializer: QueryString.stringify,
        })
        const contentType = res.headers['content-type'] ?? res.headers['Content-Type'] ?? res.headers['CONTENT-TYPE'] ?? ''
        if (!contentType.startsWith("application/json")) {
            throw new Error(`unexpected not json result, ${contentType}, response : ${res}`)
        }
        return {
            result: 'ok',
            value: res.data,
        }
    } catch (err: any) {
        const response = err.response as AxiosResponse | undefined
        if (response != null) {
            const contentType = response.headers['content-type'] ?? response.headers['Content-Type'] ?? response.headers['CONTENT-TYPE'] ?? ''
            if (response.status === 403 && contentType.startsWith('application/json')) {
                return {
                    result: 'fail',
                    value: response.data
                }
            }
        }
        throw err
    }
}

export async function requestHTTPBody(
    req: Requester,
    api: HTTPBody<string, any, MethodHTTPBody, any, any, any, any, any>,
    args: HTTPBodyArgs<GenericState, any, any, any, any>,
): Promise<Result<any, any>> {
    // setup host
    const host = req.host.resolve(api)
    // setup path
    const path = req.path.resolve(api.path, api.params, args.params)
    // setup headers
    const headers: Record<string, string | number | boolean> = {
        'content-type': 'application/json'
    }
    jwtBearer(api, args, (token) => { headers['authorization'] = `bearer ${token}` })

    try {
        const res = await axios.request({
            ...(args.axios ?? {}),
            method: api.method,
            url: `${host}${path}`,
            params: pito.wrap(api.query, args.query ?? {}),
            ...(args.body !== undefined ? { data: pito.wrap(api.body, args.body), } : { data: {} }),
            headers: headers,
            paramsSerializer: QueryString.stringify,
        })
        const contentType = res.headers['content-type'] ?? res.headers['Content-Type'] ?? res.headers['CONTENT-TYPE'] ?? ''
        if (!contentType.startsWith("application/json")) {
            throw new Error(`unexpected not json result, ${contentType}, response : ${res}`)
        }
        return {
            result: 'ok',
            value: res.data,
        }
    } catch (err: any) {
        const response = err.response as AxiosResponse | undefined
        if (response != null) {
            const contentType = response.headers['content-type'] ?? response.headers['Content-Type'] ?? response.headers['CONTENT-TYPE'] ?? ''
            if (response.status === 403 && contentType.startsWith('application/json')) {
                return {
                    result: 'fail',
                    value: response.data
                }
            }
        }
        throw err
    }
}