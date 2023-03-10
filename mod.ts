import { debounce, deferred } from "https://deno.land/std@0.175.0/async/mod.ts";
import * as path from "https://deno.land/std@0.175.0/path/mod.ts";
import { exists } from "https://deno.land/std@0.175.0/fs/mod.ts";

import * as b64 from "https://deno.land/std@0.175.0/encoding/base64.ts";

import * as embed from "./embed.ts"
import type { FileEmitter, Plugin } from "./plugins/plugins.ts"


const DIR_FILENAME = "dir.ts"

// TODO: the github trick for generated files.

export interface Mapping {
    /** A directory containing your static files. */
    sourceDir: string

    /**
     * Where to store the embedded files.
     * 
     * Note: Each input directory should store its output in a separate,
     * non-overlapping directory.
     */
    destDir: string

    /** An optional plugin, which may modify the source files before embedding. */
    plugin?: Plugin
}

// Can convert from one directory to another.
interface Converter {
    /** Do one convert */
    convert(): Promise<void>

    /**
     * Watch for changes and convert files as needed.
     * Not defined whether this is incremental or whole-directory.
     */
    watch(): Promise<void>

    /**
     * Clean up the output directory for a fresh generate.
     */
    clean(): Promise<void>
}

/** Just converts static files, no plugins. */
class StaticConverter implements Converter {

    #sourceDir: string
    #destDir: string
    #embedWriter: EmbedWriter

    constructor(options: Mapping) {
        this.#sourceDir = options.sourceDir
        this.#destDir = options.destDir
        this.#embedWriter = new EmbedWriter(options.destDir)
    }

    async convert(): Promise<void> {
        await this.#mkdirs()
    
        for await (let entry of recursiveReadDir(this.#sourceDir)) {
            await this.#convertFile(entry.name)
        }

        await this.#embedWriter.writeDir()
    }

    async #convertFile(name: string) {
        let filePath = path.join(this.#sourceDir, name)
        await this.#embedWriter.writeFile({
            filePath: name, 
            data: await Deno.readFile(filePath)
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

/**
 * Class that just writes embedded files to a directory.
 */
class EmbedWriter {

    minCompressionGainBytes = 200

    constructor (readonly destDir: string) {
        if (!path.isAbsolute(destDir)) {
            throw new Error(`destDir must be absolute: ${destDir}`)
        }
    }

    async writeFile({filePath, data}: {filePath: string, data: Uint8Array}): Promise<void> {
        let compression = "gzip"
        let compressed = await compress(data, compression)
        let gain = data.length - compressed.length
        let shouldCompress = gain >= this.minCompressionGainBytes

        let encoded = shouldCompress ? b64.encode(compressed) : b64.encode(data)
        encoded = encoded.replaceAll(/.{120}/g, (it) => it + "\n")

        
        // TODO: This is super basic to make a proof-of-concept. 
        // Eventually we can add features like:
    
        let outLines = [
            `export default {`
            , ` size: ${data.length},`
        ]

        if (shouldCompress) {
            outLines.push(` compression: "${compression}",`)
        } 
        outLines.push(` encoded: \`\n${encoded}\`,`)
        outLines.push(`}`)
        let outData = outLines.join("\n")

        let outPath = path.resolve(this.destDir, filePath + embed.GENERATED_SUFFIX)
        if (!parentChild(this.destDir, outPath)) {
            throw new Error(`${outPath} must be within ${this.destDir}`)
        }
        await Deno.mkdir(path.dirname(outPath), {recursive: true})
        await Deno.writeTextFile(outPath, outData)
    }

    /**
     * write the dir.ts file that lets us find all files.
     * 
     * You should call this after you've written all your files.
     */
    async writeDir(): Promise<void> {
        let files = await this.#readEmbeds()

        let imports = [
            `import {F, D} from "${this.#relativeEmbedImport}"`
        ]
        let body = [
            `export const contents = {`
        ]
        files.forEach((file, index) => {
            let importName = `f${index}`
            imports.push(`import ${importName} from "./${file}${embed.GENERATED_SUFFIX}"`)
            body.push(`  "${file}": F(${importName}),`)
        })

        body.push(`} as const`)

        body.push("")
        body.push(`export const dir = D(contents)`)


        let dirData = imports.join("\n") + "\n\n" + body.join("\n")

        // TODO: Is this atomic? If not, make one.
        await Deno.writeTextFile(path.join(this.destDir, DIR_FILENAME), dirData)
    }

    // TODO: make module const.
    get #relativeEmbedImport() {
        let url = embed.importMeta.url
        
        // Use a relative posix import:
        if (url.startsWith("file:"))
        {
            let dest = new URL(path.toFileUrl(this.destDir))
            let meta = new URL(url)
            return path.posix.relative(dest.pathname, meta.pathname)
        }
        
        return url
    }

    async #readEmbeds() {

        let toPosix = (p: string) => p
        if (path.SEP === "\\") {
            toPosix = (p) => p.replaceAll("\\", "/")
        }
    
        let paths: string[] = []
        for await (let entry of recursiveReadDir(this.destDir)) {
            let filePath = entry.name
            if (!filePath.endsWith(embed.GENERATED_SUFFIX)) { 
                continue

            }
            filePath = filePath.slice(0, -embed.GENERATED_SUFFIX.length)
            paths.push(toPosix(filePath))
        }

        paths.sort()
        return paths
    }

    /**
     * Delete all generated files. Run before a regenerate to start fresh.
     */
    async clean() {
        if (!await exists(this.destDir)) {
            // No dir to clean up. Probably because this is our first run:
            return
        }

        for await (let entry of recursiveReadDir(this.destDir)) {
            let fullPath = path.join(this.destDir, entry.name)
            let fileName = path.basename(entry.name)
            if (fileName.endsWith(embed.GENERATED_SUFFIX) || fileName === DIR_FILENAME) {
                await Deno.remove(fullPath)
            }
        }
    }

}

async function compress(data: Uint8Array, compression: string): Promise<Uint8Array> {
    let input = new Blob([data])
    let cs = new CompressionStream(compression)
    let stream = input.stream().pipeThrough(cs)

    let outParts: Uint8Array[] = []
    let writer = new WritableStream<Uint8Array>({
        write(chunk) {
            outParts.push(chunk)
        }
    })

    await stream.pipeTo(writer)

    let buf = await new Blob(outParts).arrayBuffer()
    return new Uint8Array(buf)
}



async function * recursiveReadDir(dir: string): AsyncGenerator<Deno.DirEntry> {
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
        for await (let child of recursiveReadDir(path.join(dir, entry.name))) {
            yield {
                ...child,
                name: path.join(dirName, child.name)
            }
        }
    }
}

class PluginConverter implements Converter {
    #plugin: Plugin
    #sourceDir: string
    #destDir: string

    constructor(options: Mapping) {
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
                await this.convert()
            }
        }
    }

    async clean(): Promise<void> {
        let writer = new EmbedWriter(this.#destDir)
        await writer.clean()
    }
}


// TODO: Is there not a built-in that does this?
function parentChild(parent: string, child: string): boolean {
    parent = path.normalize(parent)
    child = path.normalize(child)

    if (!path.isAbsolute(parent)) {
        throw new Error(`Parent path must be absolute`)
    }
    if (!path.isAbsolute(child)) {
        throw new Error(`Child path must be absolute`)
    }

    if (parent.length >= child.length) { 
        return false
    }

    while (child.length > parent.length) {
        child = path.dirname(child)
        if (child === parent) { return true }
    }

    return false
}


function converterFor(baseDir: string, opts: Mapping) {
    // Resolve relative paths if necessary:
    let sourceDir = path.resolve(baseDir, opts.sourceDir)
    let destDir =  path.resolve(baseDir, opts.destDir)
    opts = {...opts, sourceDir, destDir}

    if (opts.plugin === undefined) {
        return new StaticConverter(opts)
    }

    return new PluginConverter(opts)
}


/**
 * Run your server in "dev mode", re-converting embedded files as they are changed.
 * 
 * This is expected to be the main way you generate embedded files.
 */
export async function devMode(opts: DevOptions) {
    let baseDir = dirFrom(opts.importMeta)
    let taskName = opts.mainTask ?? "start"

    let converters = opts.mappings.map( it => converterFor(baseDir, it))

    console.log("Running first convert:")
    for (let c of converters) {
        await c.clean()
        await c.convert()
    }

    console.log("Starting server:")
    let proc = Deno.run({
        cmd: ["deno", "task", taskName],
    });

    (async () => {
        let status = await proc.status()
        console.log(`task "${taskName}" exited with status: ${status.code}`)
    })()

    for (let c of converters) {
        c.watch()
    }
}

/** Like Deno's watchFS, but will also fire an event once FS events have been quiet for a time */
class WatchFsQuiet implements AsyncIterable<Deno.FsEvent | QuietEvent> {
    #watcher: Deno.FsWatcher
    #fsIter: AsyncIterableIterator<Deno.FsEvent>;

    constructor(srcDir: string, private quietMs: number = 200) {
        this.#watcher = Deno.watchFs(srcDir)
        this.#fsIter = this.#watcher[Symbol.asyncIterator]()
    }

    async *[Symbol.asyncIterator](): AsyncIterator<Deno.FsEvent|QuietEvent> {
        let next = this.#fsIter.next()
        let quietPromise = deferred<QuietEvent>()
        let waitForQuiet = debounce(() => {
            quietPromise.resolve( {kind: "quiet", ms: this.quietMs})
            
        }, this.quietMs)

        while (true) {
            let winner = await Promise.race([next, quietPromise])
            if (isIteratorResult(winner)) {
                if (winner.done) {
                    return
                }
                waitForQuiet()
                yield winner.value
                next = this.#fsIter.next()
            } else {
                yield winner
                quietPromise = deferred()
            }
        }
    }

    close() {
        this.#watcher.close()
    }
}

function isIteratorResult(value: unknown): value is IteratorResult<Deno.FsEvent> {
    return (
        value !== null 
        && typeof(value) == "object" 
        && "value" in value
    )
}

interface QuietEvent {
    kind: "quiet"
    ms: number
}



export interface DevOptions {
    /**
     * The name of the (usually: web server) task to run in dev mode.
     * 
     * Each time you change any of your static files, the embedded files will
     * be recreated. Your task should run with `--watch` so that it will
     * automatically restart when the files change.
     * 
     * Default: "start"
     */
    mainTask?: string

    /**
     * The the importMeta of the dev.ts script in the root of your project which
     * calls this function.
     * 
     * This lets ts-embed resolve relative paths based on its directory.
     */

    importMeta: ImportMeta

    /**
     * Maps source/destination directories.
     */
    mappings: Mapping[]
}

function dirFrom(meta: ImportMeta) {
    let url = new URL(meta.url)
    let thisFile = path.fromFileUrl(url)
    return path.dirname(thisFile)
}
