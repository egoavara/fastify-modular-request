
export type IsOverlap<A extends string, B extends string> = A & B extends never ? false : true
export type IsAny<O> =
    (any extends O ? true : false) extends true
    ? true
    : false
export type IsEmpty<O> = [keyof O] extends [never] ? true : false
export type IsAnyRequired<O> = true extends ({ [_ in keyof (Required<O> & O)]: O[_] & undefined extends never ? true : false })[keyof O] ? true : false

export type ParamsSnippet<Params> = (
    IsAny<Params> extends true
    ? { params?: Params }
    : (
        IsAnyRequired<Params> extends true
        ? { params: Params }
        : { params?: Params }
    )
)

export type QuerySnippet<Query> = (
    IsAny<Query> extends true
    ? { query?: any }
    : IsEmpty<Query> extends false
    ? (
        IsAnyRequired<Query> extends true
        ? { query: Query }
        : { query?: Query }
    )
    : {}
)

export type BodySnippet<Body> = (
    IsAny<Body> extends true
    ? { body?: any }
    : (
        IsAnyRequired<Body> extends true
        ? { body: Body }
        : { body?: Body }
    )
)