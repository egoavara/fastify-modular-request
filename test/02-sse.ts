import Fastify from "fastify"
import { FastifyModular } from "fastify-modular"
import { SSE } from "fastify-modular-route"
import { pito } from "pito"
import tap from "tap"
import { Requester } from "../cjs/index.js"

tap.test('sse', async t => {
    const PORT = 12000
    const route = SSE("/ping/:until")
        .params(pito.Obj({
            until: pito.Num(),
        }))
        .query(pito.Obj({
            step: pito.Num()
        }))
        .packet(pito.Obj({
            index: pito.Num()
        }))
        .build()
    const fastify = Fastify()
    try {
        await fastify.register(
            FastifyModular('test')
                .route(route).implements(async ({ params, query, manager }) => {
                    for (let i = 0; i <= params.until; i += query.step) {
                        manager.send({ index: i })
                    }
                })
                .build()
                .instance()
                .plugin(),
            {

            }
        )
        await fastify.listen(PORT, '::')
        const req = Requester.create(`http://localhost:${PORT}`)
        const until = 100
        const step = 10
        const result = await req.request(route, {
            params: {
                until,
            },
            query: {
                step,
            },
        })
        let expected = -step
        await result.forawait(
            (ok) => {
                expected += step
                t.same(ok, { index: expected })
            },
            {
                onFail(fail) {
                    t.fail(`unexpected fail ${fail}`)
                },
                onCatch(err) {
                    t.fail(`unexpected error ${err}`)
                },
            }
        )
    } catch (err) {
        t.fail(`${err}`)
    } finally {
        await fastify.close()
    }
})
tap.test('timeout', async t => {
    const PORT = 30201
    const req = Requester.create(`http://localhost:${PORT}`)
    t.rejects(async () => {
        await req.request(SSE("/ping").build(), { sse: { timeout: 1000 } })
    })

})