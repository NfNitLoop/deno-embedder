#!/usr/bin/env -S deno run --check -A

import * as embedder from "@nfnitloop/deno-embedder"

export const options: embedder.Options = {
    importMeta: import.meta,

    mappings: [
        {
            type: "staticDir",
            path: "static",
        },
        {
            type: "denoBundle",
            sourceDir: "browser/src",
            outDir: "browser/generated",
            entrypoints: [
                "app.ts",
                "sarcasm.ts",
            ],
            sourceMap: "linked",
        }
    ]
}

if (import.meta.main) {
    await embedder.main({options})
}