export * from "jsr:@std/media-types"

import { typeByExtension } from "jsr:@std/media-types"
import { extname } from "./path.ts"

// Backward compatability for old deno.land/x/media_types:

export function lookup(filePath: string) {
    const ext = extname(filePath)
    return typeByExtension(ext)
}