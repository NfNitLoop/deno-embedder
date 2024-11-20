#!/usr/bin/env -S deno run -A --check

/**
 * This is an example embedder.ts to test auto-detecting JSX settings.
 * 
 * @module
 */

import * as embedder from "../../src/mod.ts"
import { ESBuild } from "../../src/plugins/esbuild.ts"

export const options = {
    importMeta: import.meta,

    mappings: [
        {
            sourceDir: "src",
            destDir: "generated",
            plugin: new ESBuild({
                entryPoints: ["app.tsx"],
            })
        }
    ]
}

if (import.meta.main) {
    await embedder.main({options})
}