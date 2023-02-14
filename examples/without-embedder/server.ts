import { Application } from "https://deno.land/x/oak@v9.0.1/mod.ts";

const app = new Application();

// This is how Oak recommend serving static content:
// See: https://github.com/oakserver/oak#static-content
app.use(async (context, next) => {
    try {
      await context.send({
        root: `${Deno.cwd()}/static`,
        index: "index.html",
      });
    } catch {
      await next();
    }
  });


const port = 8000
console.log(`Listening on http://localhost:${port}/`)
await app.listen({ port: 8000 });