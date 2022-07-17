import { Route } from "@fastify-modular/route"

export class ManagerHost {
    fallback: string
    domainHost: Record<string, string>
    patternHost: [RegExp, string][]

    private constructor(fallback: string, knownDomain: Record<string, string>, pathPattern: [RegExp, string][]) {
        this.fallback = fallback
        this.domainHost = knownDomain
        this.patternHost = pathPattern
    }
    static create(fallback: string, options?: Record<string, string>) {
        const PATTERN_PREFIX = "pattern:"
        const REDIRECT_PREFIX = '#'
        const knownHost: Record<string, string> = {}
        const pathHost: [RegExp, string][] = []
        for (const [k, v] of Object.entries(options ?? {})) {
            if (k.startsWith(PATTERN_PREFIX)) {
                pathHost.push([new RegExp(k.substring(PATTERN_PREFIX.length)), v])
            } else {
                knownHost[k] = v
            }
        }
        const resolver = (name: string, limit: number): string => {
            if (limit > 10) {
                throw new Error(`maximum recursive redirect reached`)
            }
            if (!(name in knownHost)) {
                throw new Error(`unknown name ${name}`)
            }
            const resolved = knownHost[name]
            if (resolved.startsWith(REDIRECT_PREFIX)) {
                const nextName = resolved.substring(REDIRECT_PREFIX.length)
                if (name === nextName) {
                    throw new Error(`infinite recursive redirect ${name}`)
                }
                return resolver(nextName, limit + 1)
            }
            return resolved
        }
        const resolvedHost = Object.fromEntries(
            Object.keys(knownHost).map(k => {
                return [k, resolver(k, 0)]
            })
        )
        const resolvedPatternHost = pathHost.map(([pattern, host]) => {
            if (host.startsWith(REDIRECT_PREFIX)) {
                return [pattern, resolver(host.substring(REDIRECT_PREFIX.length), 0)] as [RegExp, string]
            }
            return [pattern, host] as [RegExp, string]
        })
        return new ManagerHost(fallback, resolvedHost, resolvedPatternHost)
    }

    resolve(api: Route) {
        for (const patt of this.patternHost) {
            if (api.path.match(patt[0]) !== null) {
                return patt[1]
            }
        }
        if (api.domain in this.domainHost) {
            return this.domainHost[api.domain]!!
        }
        return this.fallback
    }
}