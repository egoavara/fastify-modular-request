import { readFileSync } from "fs"
import FormData from "form-data"

const fd = new FormData()

fd.append("fe", readFileSync('./05-test.ts'), '05-test.ts')
console.log(fd.getHeaders())