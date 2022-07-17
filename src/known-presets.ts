import { Route } from "@fastify-modular/route"
import { GenericState } from "./generic-state"



export type HasPreset<Key, Presets> = Key extends Presets & Key ? true : false

export type KnownPresetSnippet<Preset, State extends GenericState> =
    true extends HasPreset<'jwt-bearer', Preset> ? (State['ManagedAuth'] extends true ? { auth?: string } : { auth: string })
    : {}

export function jwtBearer(api: Route, args: any, handler: (token: string) => void) {
    if (api.presets.includes('jwt-bearer')) {
        if (typeof args['auth'] !== 'string') {
            throw new Error(`jwt-bearer require string .auth field`)
        }
        handler(args['auth'])
    }
}