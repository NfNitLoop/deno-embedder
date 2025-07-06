import type { LegacyMapping } from "@nfnitloop/deno-embedder";
import type { FileEmitter, Plugin } from "@nfnitloop/deno-embedder/plugins/plugins";
import type { Converter } from "./types.ts";
import { EmbedWriter } from "../lib/embedWriter.ts";
import { WatchFsQuiet } from "../lib/watchFs.ts";


export class PluginConverter implements Converter {
    #plugin: Plugin
    #sourceDir: string
    #destDir: string

    constructor(options: LegacyMapping) {
        if (!options.plugin)  throw new Error(`plugin is required`)
        if (options.plugin.pluginType != "whole-dir") {
            throw new Error(`Unknown plugin type: ${options.plugin.pluginType}`)
        }
        this.#plugin = options.plugin
        this.#sourceDir = options.sourceDir
        this.#destDir = options.destDir
    }

    async convert(): Promise<void> {
       
        let writer = new EmbedWriter(this.#destDir)

        let emit: FileEmitter = async (args) => {
            await writer.writeFile({
                filePath: args.file,
                data: args.contents
            })
        }

        await this.#plugin.convert({
            sourceDir: this.#sourceDir,
            destDir: this.#destDir,
            emit,
        })

        await writer.writeDir()
    }

    async watch(): Promise<void> {
        let watcher = new WatchFsQuiet(this.#sourceDir)
        for await (const event of watcher) {
            // Maybe we have a different Plugin type that supports incremental
            // updates in the future. For now, it's just re-do everything:            
            if (event.kind == "quiet") {
                console.log("Changes detected, regenerating...")
                try {
                    await this.convert()
                } catch (e) {
                    throw new Error("Error running plugin conversion", {cause: e})
                }
            }
        }
    }

    async clean(): Promise<void> {
        let writer = new EmbedWriter(this.#destDir)
        await writer.clean()
    }
}