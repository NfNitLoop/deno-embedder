#!/usr/bin/env -S deno run -A
import * as embedder from "../../../src/mod.ts"
import { ESBuild } from "../../../src/plugins/esbuild.ts";

export const options: embedder.Options = {
    importMeta: import.meta,

    mappings: [
        {
            sourceDir: "static",
            destDir: "src/embedded",
            plugin: new ESBuild({
                entryPoints: ["example.ts"],
                bundleRemoteSources: false,
            })
        },
    ]

}
export {embedder}

if (import.meta.main) {
    await embedder.main({options})
}