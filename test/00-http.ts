import tap from 'tap'
import { pito } from 'pito'
import Fastify from 'fastify'
import { FastifyModular } from 'fastify-modular'
import { HTTPBody, HTTPNoBody, MethodHTTPNoBody } from 'fastify-modular-route'
import { Requester } from "../cjs"

tap.test('no-body', async t => {
    const PORT = 10000
    const route = HTTPNoBody("GET", "/:iamParam")
        .withParams(pito.Obj({
            iamParam: pito.Str()
        }))
        .withResponse(pito.Obj({
            hello: pito.Str(),
        }))
        .build()
    const fastify = Fastify()
    try {
        await fastify.register(
            FastifyModular('test')
                .route(route).implements(async ({ params }) => {
                    return {
                        hello: params.iamParam
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
        const result = await req.request(route, {
            params: {
                iamParam: 'world',
            },
        })
        t.same(result.hello, 'world')
    } catch (err) {
        t.fail(`${err}`)
    } finally {
        await fastify.close()
    }
})


tap.test('body', async t => {
    const PORT = 10001
    const route = HTTPBody("POST", "/:a")
        .withParams(pito.Obj({
            a: pito.Str()
        }))
        .withQuery(pito.Obj({
            b: pito.Str()
        }))
        .withBody(pito.Obj({
            c: pito.Str()
        }))
        .withResponse(pito.Obj({
            concatABC: pito.Str(),
        }))
        .build()
    const fastify = Fastify()
    try {
        await fastify.register(
            FastifyModular('test')
                .route(route).implements(async ({ params, query, body }) => {
                    return {
                        concatABC: params.a + query.b + body.c
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
        const result = await req.request(route, {
            params: {
                a: 'aaa',
            },
            query: {
                b: 'bbb'
            },
            body : {
                c : 'ccc'
            }
        })
        t.same(result.concatABC, 'aaabbbccc')
    } catch (err) {
        t.fail(`${err}`)
    } finally {
        await fastify.close()
    }
})