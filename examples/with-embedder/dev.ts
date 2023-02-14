import { devMode } from "https://deno.land/x/deno-embedder/mod.ts"
import { ESBuild } from "https://deno.land/x/deno-embedder/plugins/esbuild.ts"


await devMode({
    importMeta: import.meta,
    // default: mainTask: "start",

    mappings: [
        {
            sourceDir: "static",
            destDir: "embed/static"
        },
        // Code too! :D
        {
            sourceDir: "browserCode",
            destDir: "embed/code",
            plugin: new ESBuild({
                entryPoints: ["app.ts"],
            })
        }
    ]

})