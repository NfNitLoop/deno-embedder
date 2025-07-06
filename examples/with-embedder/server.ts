import { serveDir, oak } from "@nfnitloop/deno-embedder/helpers/oak"
import sarcasm from "./browser/src/sarcasm.ts";

// Generated "directory" views of embedded files:
import bundledJs from "./browser/generated/dir.ts"
import staticFiles from "./static/dir.ts"

const router = new oak.Router()

router.get("/", (ctx) => {
    ctx.response.redirect("/static/index.html")
})

serveDir(router, "/static/", staticFiles)
serveDir(router, "/code/", bundledJs)

router.get("/text", async (ctx) => {
    // Accessing files this way gets type-checked: (typo-checked?)
    const file = await staticFiles.load("index.html")
    
    ctx.response.body = await file.bytes()
    ctx.response.headers.set("Content-Type", "text/plain")
})



const app = new oak.Application()
app.use(async (ctx, next) => {
    await next()
    const {method, url} = ctx.request
    const {status} = ctx.response
    console.log(`${status} ${method} ${url.pathname}`)
})

app.use(router.routes())
app.use(router.allowedMethods())




const port = 8000
console.log(`Listening on http://localhost:${port}/`)
console.log()
console.log(sarcasm("This is fine."))

await app.listen({ port: 8000 });

