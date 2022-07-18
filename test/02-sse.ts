import { SSE } from "@fastify-modular/route"
import Fastify from "fastify"
import { FastifyModular } from "fastify-modular"
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

    await fastify.register(
        FastifyModular('test')
            .route(route).implements(async ({ params, query, manager }) => {
                for (let i = 0; i <= params.until; i += query.step) {
                    manager.send({ index: i })
                }
                manager.close()
            })
            .build()
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
    await result.fetch({
        async onMessage(payload) {
            expected += step
            t.same(payload, { index: expected })
        },
    })
    await fastify.close()
})
// tap.test('timeout', async t => {
//     const PORT = 30201
//     const req = Requester.create(`http://localhost:${PORT}`)
//     t.rejects(async () => {
//         await req.request(SSE("/ping").build(), {})
//     })
// })