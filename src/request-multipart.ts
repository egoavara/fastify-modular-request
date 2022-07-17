
import { Multipart } from "@fastify-modular/route"
import FormData from "form-data"
import { pito } from "pito"
import qs from "qs"
import { UnexpectedResponse } from "./errors.js"
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
    // setup formdata
    const form = new FormData()
    for (const [i, v] of args.files.entries()) {
        form.append(`file-${i}`, v.file, { filename: v.name, filepath: v.path, contentType: v.contentType })
    }

    // =============================================
    // setup headers
    const headers = new Headers(args.option?.headers)
    for (const [k, v] of Object.entries(form.getHeaders())) {
        headers.set(k, v)
    }
    jwtBearer(api, args, (token) => { headers.set('authorization', `bearer ${token}`) })
    // =============================================
    // fetch option
    const fetchOption: RequestInit = {
        ...(args.option ?? {}),
        method: api.method,
        headers,
        body: form.getBuffer()
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
