import { HTTPBody, HTTPNoBody } from '@fastify-modular/route'
import Fastify from 'fastify'
import { FastifyModular } from 'fastify-modular'
import { pito } from 'pito'
import tap from 'tap'
import { Requester } from "../cjs"

tap.test('no-body', async t => {
    const PORT = 10000
    const route = HTTPNoBody("GET", "/:result")
        .params(pito.Obj({
            result: pito.Ulit('ok', 'fail')
        }))
        .query(pito.Obj({
            value: pito.Str()
        }))
        .response(pito.Obj({
            hello: pito.Str(),
        }))
        .fail(pito.Obj({
            cause: pito.Str(),
        }))
        .build()
    const fastify = Fastify({
        ajv: { customOptions: { strict: false } }
    })
    await fastify.register(
        FastifyModular('test')
            .route(route).implements(async ({ params, query, fail }) => {
                if (params.result === 'fail') {
                    fail({ cause: query.value })
                }
                return {
                    hello: query.value
                }
            })
            .build()
            .plugin(),
        {

        }
    )
    await fastify.listen({ port: PORT })
    await new Promise(resolve => setTimeout(resolve, 1000))
    const req = Requester.create(`http://localhost:${PORT}`)
    {
        // ok
        await req.request(route, {
            params: { result: 'ok' },
            query: { value: 'world' }
        }).ok(ok => {
            t.same(ok, { hello: 'world' })
        }).fail(fail => {
            t.fail(`unexpected fail ${fail}`)
        }).catch(err => {
            t.fail(`unexpected catch ${err}`)
        })
    }
    {
        // fail
        await req.request(route, {
            params: { result: 'fail' },
            query: { value: 'cause' }
        }).ok(ok => {
            t.fail(`unexpected ok ${ok}`)
        }).fail(fail => {
            t.same(fail, { cause: 'cause' })
        }).catch(err => {
            t.fail(`unexpected catch ${err}`)
        })
    }
    await fastify.close()
})


tap.test('body', async t => {
    const PORT = 10001
    const route = HTTPBody("POST", "/:result")
        .params(pito.Obj({
            result: pito.Ulit('ok', 'fail'),
        }))
        .body(pito.Obj({
            value: pito.Str()
        }))
        .response(pito.Obj({
            oinner: pito.Str(),
        }))
        .fail(pito.Obj({
            finner: pito.Str(),
        }))
        .build()
    const fastify = Fastify({
        ajv: { customOptions: { strict: false } }
    })

    await fastify.register(
        FastifyModular('test')
            .route(route).implements(async ({ params, query, body, fail }) => {
                if (params.result === 'fail') {
                    fail({
                        finner: body.value
                    })
                }
                return {
                    oinner: body.value
                }
            })
            .build()
            .plugin(),
        {

        }
    )
    await fastify.listen(PORT, '::')
    const req = Requester.create(`http://localhost:${PORT}`)
    await req.request(route, {
        params: { result: 'ok' },
        body: { value: 'inner' }
    }).ok(ok => {
        t.same(ok, { oinner: 'inner' })
    }).fail(fail => {
        t.fail(`unexpected fail ${fail}`)
    }).catch(err => {
        t.fail(`unexpected error ${err}`)
    })
    await req.request(route, {
        params: { result: 'fail' },
        body: { value: 'inner' }
    }).ok(ok => {
        t.fail(`unexpected ok ${ok}`)
    }).fail(fail => {
        t.same(fail, { finner: 'inner' })
    }).catch(err => {
        t.fail(`unexpected error ${err}`)
    })
    await fastify.close()
})
tap.test('body null', async t => {
    const PORT = 10002
    const route = HTTPBody("POST", "/").build()
    const fastify = Fastify({
        ajv: { customOptions: { strict: false } }
    })

    await fastify.register(
        FastifyModular('test')
            .route(route).implements(async ({ body }) => {
                t.same(body, null)
                return null
            })
            .build()
            .plugin(),
        {}
    )
    await fastify.listen({ port: PORT })
    const req = Requester.create(`http://localhost:${PORT}`)
    t.same(await req.request(route, {}).ok(), null)
    await fastify.close()
})