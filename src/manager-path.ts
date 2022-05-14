import { pito } from "pito"

export class ManagerPath{
    
    private constructor(){
    }
    static create(){
        return new ManagerPath()
    }
    resolve(path: string, paramsDef: pito.Obj<Record<string, pito>>, params: Record<string, any>): string {
        let result = path
        for (const [k, v] of Object.entries(paramsDef.properties)) {
            if (!(k in params)) {
                throw new Error(`url parameter style key '${k}' not found`)
            }
            result = path.replaceAll(`:${k}`, `${pito.wrap(v, params[k])}`)
        }
        if(!result.startsWith("/")){
            return "/" + result
        }
        return result
    }

}