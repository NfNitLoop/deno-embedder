// NOTE: These are relative paths because the source code for deno-embedder
// lives in the same repository as this example. You should import these from
// `jsr:@nfnitloop/deno-embedder@version`
//
import * as embedder from "../../src/mod.ts"
import { ESBuild } from "../../src/plugins/esbuild.ts"


export const options = {
    importMeta: import.meta,

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

}
export {embedder}

if (import.meta.main) {
    await embedder.main({options})
}