#!/usr/bin/env -S deno run --check -A


import * as embedder from "@nfnitloop/deno-embedder"
import { ESBuild } from "@nfnitloop/deno-embedder/plugins/esbuild"

// Example:
// import * as embedder from "jsr:@nfnitloop/deno-embedder@1.4.9"
// import { ESBuild } from "jsr:@nfnitloop/deno-embedder@1.4.9/plugins/esbuild/"


export const options: embedder.Options = {
    importMeta: import.meta,

    mappings: [
        {
            type: "staticDir",
            path: "static",
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

}

if (import.meta.main) {
    await embedder.main({options})
}