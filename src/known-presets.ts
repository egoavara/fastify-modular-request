import { Route } from "fastify-modular-route"


export type KnownPresetSnippet<Preset> =
    'jwt-bearer' extends Preset & 'jwt-bearer'
    ? { auth: string }
    : {}

export function jwtBearer(api: Route, args: any, handler: (token: string) => void) {
    if (api.presets.includes('jwt-bearer')) {
        if (typeof args['auth'] !== 'string') {
            throw new Error(`jwt-bearer require string .auth field`)
        }
        handler(args['auth'])
    }
}