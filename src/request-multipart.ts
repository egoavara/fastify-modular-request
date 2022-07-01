
import * as Axios from "axios"
import { Multipart } from "fastify-modular-route"
import FormData from "form-data"
import { pito } from "pito"
import QueryString from "qs"
import { UnexpectedStatus } from "./errors.js"
import { GenericState } from "./generic-state.js"
import { MultipartArgs, Requester } from "./index.js"
import { jwtBearer } from "./known-presets.js"
import { Result } from "./result.js"

export type MultipartFile = {
    file: any,
    name?: string
    path?: string
    contentType?: string
}


export async function requestMultipart(
    req: Requester,
    api: Multipart<string, string, any, any, any, any>,
    args: MultipartArgs<GenericState, any, any, any>,

): Promise<Result<any, any>> {
    // setup host
    const host = req.host.resolve(api)
    // setup path
    const path = req.path.resolve(api.path, api.params, args.params)
    // setup formdata
    const form = new FormData()
    for (const [i, v] of args.files.entries()) {
        form.append(`file-${i}`, v.file, { filename: v.name, filepath: v.path, contentType: v.contentType })
    }
    // setup headers
    const headers: Record<string, string | number | boolean> = form.getHeaders()
    jwtBearer(api, args, (token) => { headers['authorization'] = `bearer ${token}` })
    try {
        const res = await Axios.default.request({
            method: 'POST',
            url: `${host}${path}`,
            params: pito.wrap(api.query, args.query),
            paramsSerializer: QueryString.stringify,
            data: form,
            headers,
            ...(args.axios ?? {}),
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
        const response = err.response as Axios.AxiosResponse | undefined
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
