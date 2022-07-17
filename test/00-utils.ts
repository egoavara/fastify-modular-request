import { pito } from "pito"
import tap from "tap"
import { ManagerPath } from "../cjs/manager-path.js"
import { ManagerHost } from "../cjs/manager-host.js"
import { PResult } from "../cjs/result.js"
import { HTTPNoBody } from "@fastify-modular/route"

tap.test('manager-path', async t => {
    const path = ManagerPath.create()
    t.same(path.resolve('/:p0/:p1', pito.Obj({ p0: pito.Num(), p1: pito.Str(), }), { p0: 1, p1: 'hello' }), '/1/hello')
    t.same(path.resolve('', pito.Obj({}), {}), '/')
    // 
    t.rejects(async () => { path.resolve('', pito.Obj({ p0: pito.Num() }), {}) })
})

tap.test('manager-host', async t => {
    const noOption = ManagerHost.create('http://fallback.com')
    const path = ManagerHost.create('http://fallback.com',
        {
            'base': 'http://base.com',
            'rebase': '#base',
            'pattern:^/hello': 'http://hello.com',
            'redirect': '#rebase',
            'pattern:^/redirect': '#redirect'
        }
    )
    t.same(noOption.resolve(HTTPNoBody('GET', '/hello', 'base').build()), 'http://fallback.com')
    t.same(path.resolve(HTTPNoBody('GET', '/').build()), 'http://fallback.com')
    t.same(path.resolve(HTTPNoBody('GET', '/', 'base').build()), 'http://base.com')
    t.same(path.resolve(HTTPNoBody('GET', '/', 'rebase').build()), 'http://base.com')
    t.same(path.resolve(HTTPNoBody('GET', '/', 'unknown').build()), 'http://fallback.com')
    t.same(path.resolve(HTTPNoBody('GET', '/hello', 'base').build()), 'http://hello.com')
    t.same(path.resolve(HTTPNoBody('GET', '/redirect', 'base').build()), 'http://base.com')
    // 
    t.rejects(async () => {
        ManagerHost.create('',
            {
                'r0': 'http://r0.com',
                'r1': '#r0',
                'r2': '#r1',
                'r3': '#r2',
                'r4': '#r3',
                'r5': '#r4',
                'r6': '#r5',
                'r7': '#r6',
                'r8': '#r7',
                'r9': '#r8',
                'r10': '#r9',
                'r11': '#r10',
            }
        )
    })
    t.rejects(async () => {
        ManagerHost.create('',
            {
                'r0': '#r0',
            }
        )
    })
    t.rejects(async () => {
        ManagerHost.create('',
            {
                'r0': '#unknown',
            }
        )
    })
})

tap.test('presult', async t => {
    t.same(
        await PResult(Promise.resolve({ result: 'ok', value: 'hello, world' })).ok(),
        'hello, world'
    )
    await PResult(Promise.resolve({ result: 'ok', value: 'hello, world' })).ok((ok) => {
        t.same(ok, 'hello, world')
    })

    t.same(
        await PResult(Promise.resolve({ result: 'fail', value: 'hello, world' })).fail(),
        'hello, world'
    )
    await PResult(Promise.resolve({ result: 'fail', value: 'hello, world' })).fail((fail) => {
        t.same(fail, 'hello, world')
    })
})