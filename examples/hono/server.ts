import { Hono } from "../../deps/hono.ts";
import { serveStatic } from "../../helpers/hono.ts";
import staticFiles from "./embed/static/dir.ts";
import bundledJs from "./embed/code/dir.ts";

const app = new Hono();

app.get("/", (c) => {
  return c.redirect("/static/index.html");
});

app.use(
  "/static/*",
  serveStatic({
    root: staticFiles,
    rewriteRequestPath(path) {
      return path.replace(/^\/static\//, "/");
    },
  })
);

app.use(
  "/code/*",
  serveStatic({
    root: bundledJs,
    rewriteRequestPath: (path) => path.replace(/^\/code\//, "/"),
  })
);

app.get("/text", async (c) => {
  // Accessing files this way gets type-checked: (typo-checked?)
  let file = await staticFiles.load("index.html");
  return c.text(await file.text());
});

Deno.serve(
  {
    port: 8000,
  },
  app.fetch
);
