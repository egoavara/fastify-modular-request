
import axios from "axios"
import { Multipart } from "fastify-modular-route"
import FormData from "form-data"
import QueryString from "qs"
import { GenericState } from "./generic-state.js"
import { MultipartArgs, Requester } from "./index.js"
import { jwtBearer } from "./known-presets.js"

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

): Promise<any> {
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


    return axios.request({
        method: 'POST',
        url: `${host}${path}`,
        params: args.query,
        paramsSerializer: QueryString.stringify,
        data: form,
        headers,
        ...(args.axios ?? {})

    }).then(v => {
        const contentType = v.headers['content-type'] ?? v.headers['Content-Type'] ?? v.headers['CONTENT-TYPE'] ?? ''
        if (!contentType.startsWith("application/json")) {
            throw new Error(`unexpected not json result, ${contentType}, response : ${v}`)
        }
        return v.data
    })
}
