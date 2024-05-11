export * from "jsr:@std/media-types@0.224.0"

import { typeByExtension } from "jsr:@std/media-types@0.224.0"
import { extname } from "./path.ts"

// Backward compatability for old deno.land/x/media_types:

export function lookup(filePath: string) {
    const ext = extname(filePath)
    return typeByExtension(ext)
}