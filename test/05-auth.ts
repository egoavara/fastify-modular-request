import Fastify from 'fastify'
import { FastifyModular } from 'fastify-modular'
import { failure, HTTPNoBody } from '@fastify-modular/route'
import tap from 'tap'
import { Requester } from "../cjs"

const JWTModule = FastifyModular('jwt-module')
    .when({ includes: ['jwt-bearer'] }).define('jwtResult', async ({ }, _, { request }) => {
        const auth = request.headers.authorization
        if (auth === undefined) {
            throw failure('no authorization header', 403)
        }
        if (!auth.startsWith('bearer')) {
            throw failure('no bearer authorization header', 403)
        }
        const rawToken = auth.substring(6).trimStart()
        return {
            raw: rawToken,
        }
    }).end()
    .build()

// tap.test('unmanaged', async t => {
//     const PORT = 14000
//     const route = HTTPNoBody("GET", "/")
//         .presets('jwt-bearer')
//         .build()
//     const fastify = Fastify()
//     try {
//         // https://jwt.io/
//         const EXAMPLE_JWT = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c'
//         t.plan(1)
//         await fastify.register(
//             FastifyModular('test')
//                 .import(JWTModule).from()
//                 .route(route).implements(async ({ }, { jwtResult }) => {
//                     t.same(jwtResult, { raw: EXAMPLE_JWT })
//                 })
//                 .build()
//                 .plugin(),
//             {

//             }
//         )

//         await fastify.listen(PORT, '::')
//         const req = Requester.create(`http://localhost:${PORT}`)
//         await req.request(route, { auth: EXAMPLE_JWT })
//     } catch (err) {
//         t.fail(`${err}`)
//     } finally {
//         await fastify.close()
//     }
// })
tap.test('managed', async t => {
    const PORT = 14001
    const route = HTTPNoBody("GET", "/")
        .presets('jwt-bearer')
        .build()
    const fastify = Fastify()
    try {
        // https://jwt.io/
        const EXAMPLE_JWT_INVALID = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c'
        const EXAMPLE_JWT_VALID = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkphbmUgUm9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.8-PNa_8kYAU1vpJEf1WAYGRLjhcGyTSqSbTsm3HkUMA'
        t.plan(2)
        await fastify.register(
            FastifyModular('test')
                .import(JWTModule).from()
                .route(route).implements(async ({ fail }, { jwtResult }) => {
                    if (jwtResult.raw === EXAMPLE_JWT_INVALID) {
                        t.pass()
                        return fail('invalid jwt', 403)
                    }
                    t.same(jwtResult, { raw: EXAMPLE_JWT_VALID })
                })
                .build()
                .plugin(),
            {

            }
        )

        await fastify.listen(PORT, '::')
        const req = Requester.create(`http://localhost:${PORT}`)
            .jwtManaged(
                async () => {
                    return EXAMPLE_JWT_INVALID
                },
                async () => {
                    return EXAMPLE_JWT_VALID
                }
            )
        await req.request(route, {})
    } catch (err) {
        t.fail(`${err}`)
    } finally {
        await fastify.close()
    }
})