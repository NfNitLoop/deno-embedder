import { EmbedWriter } from "../lib/embedWriter.ts";
import type { LegacyMapping } from "@nfnitloop/deno-embedder";
import type { Converter } from "./types.ts";
import { recursiveReadDir } from "../lib/util.ts";
import * as path from "@std/path"
import { WatchFsQuiet } from "../lib/watchFs.ts";

/** Just converts static files, no plugins. */
export class StaticConverter implements Converter {

    #sourceDir: string
    #destDir: string
    #embedWriter: EmbedWriter

    constructor(options: LegacyMapping) {
        this.#sourceDir = options.sourceDir
        this.#destDir = options.destDir
        this.#embedWriter = new EmbedWriter(options.destDir)
    }

    async convert(): Promise<void> {
        // TODO: Could we do this atomically, in a tempdir, then move it into place?
        // Or would that mess up `deno run --watch`?

        await this.#embedWriter.clean()
        await this.#mkdirs()
    
        for await (const entry of recursiveReadDir(this.#sourceDir)) {
            await this.#convertFile(entry.name)
        }

        await this.#embedWriter.writeDir()
    }

    async #convertFile(relPath: string) {
        let fullPath = path.join(this.#sourceDir, relPath)
        await this.#embedWriter.writeFile({
            filePath: relPath, 
            data: await Deno.readFile(fullPath)
        })
    }

    async #mkdirs() {
        await Deno.mkdir(this.#destDir, {recursive: true})
    }

    async watch(): Promise<void> {
        let watcher = new WatchFsQuiet(this.#sourceDir)
        for await (const event of watcher) {
            // TODO: Later, we can collect FS events here and efficiently update
            // only what changed since the previous quiet period. 
            
            if (event.kind == "quiet") {
                console.log("Changes detected, regenerating...")
                await this.convert()
            }
        }
    }

    async clean(): Promise<void> {
        await this.#embedWriter.clean()
    }
}