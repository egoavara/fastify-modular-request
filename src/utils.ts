
export type IsOverlap<A extends string, B extends string> = A & B extends never ? false : true
export type IsAny<O> =
    (any extends O ? true : false) extends true
    ? true
    : false
export type IsEmpty<O> = [keyof O] extends [never] ? true : false
export type IsAllOptional<O> = O[keyof O] & undefined extends never ? false : true

export type ParamsSnippet<Params> = (
    IsAny<Params> extends true 
    ? { params?: Params } 
    : (
        IsEmpty<Params> extends false
        ? { params: Params }
        : { params?: Params }
    )
)

export type QuerySnippet<Query> = (
    IsAny<Query> extends true
    ? { query?: any }
    : IsEmpty<Query> extends false
    ? (
        IsAllOptional<Query> extends true
        ? { query?: Query }
        : { query: Query }
    )
    : {}
)
export type BodySnippet<Body> = (
    IsAny<Body> extends true
    ? { body?: any }
    : IsEmpty<Body> extends false
    ? { body: Body }
    : { body?: Body }
)