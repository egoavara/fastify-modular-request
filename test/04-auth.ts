import Fastify from 'fastify'
import { FastifyModular } from 'fastify-modular'
import { HTTPNoBody } from 'fastify-modular-route'
import tap from 'tap'
import { Requester } from "../cjs"

tap.test('unmanaged', async t => {
    const PORT = 14000
    const route = HTTPNoBody("GET", "/")
        .withPreset('jwt-bearer')
        .build()
    const fastify = Fastify()
    try {
        // https://jwt.io/
        const EXAMPLE_JWT = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c'
        t.plan(1)
        await fastify.register(
            FastifyModular('test')
                .route(route).implements(async ({ headers }) => {
                    t.same(headers.authorization, `bearer ${EXAMPLE_JWT}`)
                    return {
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
        await req.request(route, { auth: EXAMPLE_JWT })
    } catch (err) {
        t.fail(`${err}`)
    } finally {
        await fastify.close()
    }
})
tap.test('managed', async t => {
    const PORT = 14001
    const route = HTTPNoBody("GET", "/")
        .withPreset('jwt-bearer')
        .build()
    const fastify = Fastify()
    try {
        // https://jwt.io/
        const EXAMPLE_JWT = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c'
        t.plan(1)
        await fastify.register(
            FastifyModular('test')
                .route(route).implements(async ({ headers }) => {
                    t.same(headers.authorization, `bearer ${EXAMPLE_JWT}`)
                    return {
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
            .jwtManaged(
                async () => {
                    return EXAMPLE_JWT
                },
                async () => {
                    t.fail('expired not happen')
                    return ''
                }
            )
        await req.request(route, {})
    } catch (err) {
        t.fail(`${err}`)
    } finally {
        await fastify.close()
    }
})
// tap.test('expired', async t => {
//     const PORT = 14001
//     const route = HTTPNoBody("GET", "/")
//         .withPreset('jwt-bearer')
//         .build()
//     const fastify = Fastify()
//     try {
//         // https://jwt.io/
//         const EXAMPLE_JWT_1 = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c'
//         const EXAMPLE_JWT_2 = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkphbmUgRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.cMErWtEf7DxCXJl8C9q0L7ttkm-Ex54UWHsOCMGbtUc'
//         t.plan(2)
//         await fastify.register(
//             FastifyModular('test')
//                 .route(route).implements(async ({ headers }, _0, _1, _2, _3, reply) => {
//                     console.log('header', headers)
//                     if (headers.authorization === `bearer ${EXAMPLE_JWT_1}`) {
//                         t.pass()
//                         reply.code(401)
//                         return
//                     } else if (headers.authorization === `bearer ${EXAMPLE_JWT_2}`) {
//                         t.pass()
//                         return
//                     } else {
//                         console.log(headers.authorization)
//                         console.log(`bearer ${EXAMPLE_JWT_1}`)
//                         console.log(`bearer ${EXAMPLE_JWT_2}`)
//                         t.fail('unexpected authorization')
//                         return
//                     }
//                 })
//                 .build()
//                 .instance()
//                 .plugin(),
//             {

//             }
//         )

//         await fastify.listen(PORT, '::')
//         const req = Requester.create(`http://localhost:${PORT}`)
//             .jwtManaged(
//                 async () => {
//                     console.log('call jwt1')
//                     return EXAMPLE_JWT_1
//                 },
//                 async () => {
//                     console.log('call jwt2')
//                     return EXAMPLE_JWT_2
//                 }
//             )
//         await req.request(route, {})
//     } catch (err) {
//         console.log('failed')
//         t.fail(`${err}`)
//     } finally {
//         await fastify.close()
//     }
// })