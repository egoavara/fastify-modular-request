import { WS } from "@fastify-modular/route"
import Fastify from "fastify"
import { FastifyModular } from "fastify-modular"
import { pito } from "pito"
import tap from "tap"
import { Requester } from "../cjs/index.js"

tap.test('ws', async t => {
    const PORT = 13000
    const route = WS("/ping-pong")
        .send(pito.Obj({
            pong: pito.Num()
        }))
        .recv(pito.Obj({
            ping: pito.Num()
        }))
        .response({
            'greet-server': { args: [pito.Str()], return: pito.Str() }
        })
        .request({
            'greet-client': { args: [pito.Str()], return: pito.Str() }
        })
        .build()
    const fastify = Fastify()
    try {
        await fastify.register(
            FastifyModular('test')
                .route(route).implements(async ({ manager }) => {
                    manager.onResponse('greet-server', async (name) => `hello, ${name}, i am server`)
                    manager.onReceive(async (data) => { manager.send({ pong: data.ping }) })
                    await manager.ready()
                    await manager.until()
                })
                .build()
                .plugin(),
            {

            }
        )
        await fastify.listen(PORT, '::')
        const req = Requester.create(`http://localhost:${PORT}`)
        const conn = await req.request(route, {})
        const pongs: number[] = []
        const PING_COUNT = 11
        conn.onReceive(async (data) => {
            pongs.push(data.pong)
            if (pongs.length === PING_COUNT) {
                for (const [i, v] of pongs.sort((a, b) => a - b).entries()) {
                    t.same(i, v)
                }
            }
        })
        conn.onResponse('greet-client', async (name) => {
            return `hello, ${name}, i am client`
        })
        await conn.ready()
        for (let i = 0; i < PING_COUNT; i++) {
            conn.send({ ping: i })
        }
        t.same(await conn.request('greet-server', 'client'), `hello, client, i am server`)
        conn.close()
    } catch (err) {
        t.fail(`${err}`)
    } finally {
        await fastify.close()
    }
})