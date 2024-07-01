import * as embedder from "../../../src/mod.ts"

export const options = {
    importMeta: import.meta,

    mappings: [
        {
            sourceDir: "static",
            destDir: "src/embedded"
        },
    ]

}
export {embedder}

if (import.meta.main) {
    await embedder.main({options})
}