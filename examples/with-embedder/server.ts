import { serveDir, oak } from "../../helpers/oak.ts"
import * as staticFiles from "./embed/static/dir.ts"
import * as bundledJs from "./embed/code/dir.ts"
import sarcasm from "./browserCode/sarcasm.ts";

const router = new oak.Router()

router.get("/", (ctx) => {
    ctx.response.redirect("/static/index.html")
})

serveDir(router, "/static/", staticFiles.dir)
serveDir(router, "/code/", bundledJs.dir)

router.get("/text", async (ctx) => {
    // Accessing files this way gets type-checked: (typo-checked?)
    let file = await staticFiles.get("index.html")
    
    ctx.response.body = await file.bytes()
    ctx.response.headers.set("Content-Type", "text/plain")
})



const app = new oak.Application()
app.use(router.routes())
app.use(router.allowedMethods())




const port = 8000
console.log(`Listening on http://localhost:${port}/`)
console.log()
console.log(sarcasm("This is fine."))

await app.listen({ port: 8000 });

