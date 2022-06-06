// http manager using axios as requester

import type { AxiosResponse } from "axios"
import axios from "axios"
import { HTTPBody, HTTPNoBody, MethodHTTPBody, MethodHTTPNoBody } from "fastify-modular-route"
import { pito } from "pito"
import QueryString from "qs"
import { UnexpectedStatus } from "./errors.js"
import { GenericState } from "./generic-state.js"
import { HTTPBodyArgs, HTTPNoBodyArgs, Requester } from "./index.js"
import { jwtBearer } from "./known-presets.js"
import { Result } from "./result.js"

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
            params: pito.wrap(api.query, args.query),
            headers: headers,
            paramsSerializer: QueryString.stringify,
        })
        const contentType = res.headers['content-type'] ?? res.headers['Content-Type'] ?? res.headers['CONTENT-TYPE'] ?? ''
        if (!contentType.startsWith("application/json")) {
            throw new Error(`unexpected not json result, ${contentType}, response : ${res}`)
        }
        if (res.status === 204) {
            return {
                result: 'ok',
                value: pito.unwrap(api.response, undefined),
            }
        } else if (res.status === 200) {
            return {
                result: 'ok',
                value: pito.unwrap(api.response, res.data),
            }
        } else {
            throw new UnexpectedStatus(res.status)
        }
    } catch (err: any) {
        const response = err.response as AxiosResponse | undefined
        if (response != null) {
            const contentType = response.headers['content-type'] ?? response.headers['Content-Type'] ?? response.headers['CONTENT-TYPE'] ?? ''
            if (response.status === 406 && contentType.startsWith('application/json')) {
                return {
                    result: 'fail',
                    value: pito.unwrap(api.fail, response.data),
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
            params: pito.wrap(api.query, args.query),
            ...(args.body !== undefined ? { data: pito.wrap(api.body, args.body), } : { data: {} }),
            headers: headers,
            paramsSerializer: QueryString.stringify,
        })
        const contentType = res.headers['content-type'] ?? res.headers['Content-Type'] ?? res.headers['CONTENT-TYPE'] ?? ''
        if (!contentType.startsWith("application/json")) {
            throw new Error(`unexpected not json result, ${contentType}, response : ${res}`)
        }
        if (res.status === 204) {
            return {
                result: 'ok',
                value: pito.unwrap(api.response, undefined),
            }
        } else if (res.status === 200) {
            return {
                result: 'ok',
                value: pito.unwrap(api.response, res.data),
            }
        } else {
            throw new UnexpectedStatus(res.status)
        }
    } catch (err: any) {
        const response = err.response as AxiosResponse | undefined
        if (response != null) {
            const contentType = response.headers['content-type'] ?? response.headers['Content-Type'] ?? response.headers['CONTENT-TYPE'] ?? ''
            if (response.status === 406 && contentType.startsWith('application/json')) {
                return {
                    result: 'fail',
                    value: pito.unwrap(api.fail, response.data),
                }
            }
        }
        throw err
    }
}