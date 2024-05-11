/** 
 * Functions used by both mod.ts and embed.ts
 * @module
 */

import { join as pathJoin } from "../deps/std/path.ts";

/** Read all files from a directory tree, recursively.  */
export async function * recursiveReadDir(dir: string): AsyncGenerator<Deno.DirEntry> {
    for await (let entry of Deno.readDir(dir)) {
        if (entry.isSymlink) {
            console.warn(`Symlinks are unsupported: ${entry.name}`)
            continue
        }
        if (entry.isFile) {
            yield entry
            continue
        }
        // entry.isDirectory
        let dirName = entry.name
        for await (let child of recursiveReadDir(pathJoin(dir, dirName))) {
            yield {
                ...child,
                name: pathJoin(dirName, child.name)
            }
        }
    }
}