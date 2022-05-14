import { Route } from "fastify-modular-route"

export class ManagerHost {
    fallback: string
    knownDomain: Record<string, string>
    pathPattern: [RegExp, string][]

    private constructor(fallback: string, knownDomain: Record<string, string>, pathPattern: [RegExp, string][]) {
        this.fallback = fallback
        this.knownDomain = knownDomain
        this.pathPattern = pathPattern
    }
    static create(fallback: string, options?: Record<string, string>) {
        const PATH_PREFIX = "path:"
        const REDIRECT_PREFIX = "@"
        const knownDomain: Record<string, string> = {}
        const pathPattern: [RegExp, string][] = []
        for (const [k, v] of Object.entries(options ?? {})) {
            if (k.startsWith(PATH_PREFIX)) {
                pathPattern.push([new RegExp(k.substring(PATH_PREFIX.length)), v])
            } else {
                knownDomain[k] = v
            }
        }
        const resolveEachDomain = (domain: string): string => {
            if (!(domain in knownDomain)) {
                throw new Error(`unknown domain '${domain}'`)
            }
            if (knownDomain[domain].startsWith(REDIRECT_PREFIX)) {
                return resolveEachDomain(knownDomain[domain].substring(REDIRECT_PREFIX.length))
            }
            return knownDomain[domain]
        }

        const resolvedDomain = Object.fromEntries(Object.keys(knownDomain).map(v => [v, resolveEachDomain(v)]))
        const resolvedPathPattern = pathPattern.map(([re, domain]) => {
            if (domain.startsWith(REDIRECT_PREFIX)) {
                return [re, resolveEachDomain(domain.substring(REDIRECT_PREFIX.length))] as [RegExp, string]
            }
            return [re, domain] as [RegExp, string]
        })
        return new ManagerHost(fallback, resolvedDomain, resolvedPathPattern)
    }

    resolve(api: Route) {
        if (api.domain in this.knownDomain) {
            return this.knownDomain[api.domain]!!
        }
        for (const patt of this.pathPattern) {
            if (api.path.match(patt[0]) === null) {
                return patt[1]
            }
        }
        return this.fallback
    }
}