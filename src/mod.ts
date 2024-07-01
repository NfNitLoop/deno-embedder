/**
 * Deno Embedder
 * =============
 * 
 * Deno Embedder lets you embed binary files (.png, .txt, etc.)
 * into your deno project without requiring that users grant it
 * `--allow-read` or `--allow-net` permissions.
 * 
 * For getting started documentation and examples, see:
 * <https://github.com/NfNitLoop/deno-embedder#readme>
 * 
 * @module
 */

import { debounce, deferred } from "./deps/std/async.ts";
import * as path from "./deps/std/path.ts";
import { exists } from "./deps/std/fs.ts";
import { encodeBase64 } from "./deps/std/encoding/base64.ts"

import { Command } from "./deps/cliffy/command.ts";


import * as embed from "./embed.ts"
import type { FileEmitter, Plugin } from "./plugins/plugins.ts"
import { recursiveReadDir } from "./util.ts";
import { toJsr } from "./jsr_fix.ts";

const VERSION = "1.0.0"
const DIR_FILENAME = "dir.ts"

/**
 * Configures a mapping from an input "source" dir, to an output destination.
 */
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
        const compression = "gzip"
        let compressed = await compress(data, compression)
        let gain = data.length - compressed.length
        let shouldCompress = gain >= this.minCompressionGainBytes

        let encoded = shouldCompress ? encodeBase64(compressed) : encodeBase64(data)
        encoded = encoded.replaceAll(/.{120}/g, (it) => it + "\n")

        const {onDisk: outPath} = this.#addFile(filePath)
    
        let outLines = [
            `import {F} from "${relativeEmbedImport(outPath)}"`,
            `export default F({`
            , ` size: ${data.length},`
        ]

        if (shouldCompress) {
            outLines.push(` compression: "${compression}",`)
        } 
        outLines.push(` encoded: \`\n${encoded}\`,`)
        outLines.push(`})`)
        let outData = outLines.join("\n")


        await Deno.mkdir(path.dirname(outPath), {recursive: true})
        await Deno.writeTextFile(outPath, outData)
    }

    /**
     * Add a file to our internal list of files in this dir.
     * 
     * Returns an object w/ normalized/non-normalized paths.
     * 
     */
    #addFile(filePath: string): FilePaths {
        const absPath = path.resolve(this.destDir, filePath)
        if (!parentChild(this.destDir, absPath)) {
            // Don't allow Plugin authors to emit to, say, ../someOtherFile.ts:
            throw new Error(`${absPath} must be within ${this.destDir}`)
        }
        const relative = toPosix(path.relative(this.destDir, absPath))

        // Spaces aren't allowed on JSR:
        let normalized = relative.replaceAll(/[ ]+/g, "_")
        // .d.ts *anywhere* in the file name invokes special typescript behavior:
        normalized = normalized.replaceAll(".d.ts", ".d_ts")
        const {base, dir} = path.parse(normalized)
        // Prefix generated files with _ so they sorts together nicely. (makes dir.ts easy to see.)
        normalized = path.posix.join(dir, `_${base}.ts`)

        const onDisk = path.join(this.destDir, normalized)
        const importPath = "./" + normalized

        const paths: FilePaths = {
            original: filePath,
            relative,
            import: importPath,
            onDisk,
        }

        const existing = this.#files.get(paths.onDisk)
        if (existing) {
            const msg = [
                `Two files normalize to the same on-disk location: "${paths.onDisk}":`,
                `1) "${existing.original}"`,
                `2) "${paths.original}"`,
            ].join("\n")
            throw new Error(msg)
        }
        this.#files.set(paths.onDisk, paths)

        return paths
    }

    /** Files we've written, keyed by .onDisk */
    #files = new Map<string, FilePaths>()

    /**
     * write the dir.ts file that lets us find all files.
     * 
     * You should call this after you've written all your files.
     */
    async writeDir(): Promise<void> {
        // Files, sorted by the relative path, for output stability:
        let files = [...this.#files.values()].sort(byKey(it => it.relative))

        const outPath = path.join(this.destDir, DIR_FILENAME)

        let imports = [
            `import {E} from "${relativeEmbedImport(outPath)}"`
        ]
        let body = [
            `export default E({`
        ]
        files.forEach(file => {
            body.push(`  "${file.relative}": () => import("${file.import}"),`)
        })

        body.push(`})`)

        body.push("")


        let dirData = imports.join("\n") + "\n\n" + body.join("\n")

        // TODO: Is this atomic? If not, make one.
        await Deno.writeTextFile(outPath, dirData)

        // Also mark these files as generated for git/github:
        await Deno.writeTextFile(
            path.join(this.destDir, ".gitattributes"),
            `* linguist-generated=true`
        )
    }

    /**
     * Delete all generated files. Run before a regenerate to start fresh.
     */
    async clean() {
        this.#files.clear()

        if (!await exists(this.destDir) || await isEmptyDir(this.destDir)) {
            // No dir to clean up. Probably because this is our first run:
            return
        }

        if (!await exists(path.join(this.destDir, DIR_FILENAME))) {
            throw new Error(`${this.destDir} lacks a ${DIR_FILENAME}, so may not be a generated directory. Refusing to clean it up.`)
        }

        await Deno.remove(this.destDir, {recursive: true})
    }

}

async function isEmptyDir(path: string) {
    for await (const _entry of Deno.readDir(path)) {
        return false
    }
    return true
}

/** Used with Array.sort to sort elements by some key. */ 
function byKey<T, K extends number|string>(keyFn: KeyFn<T,K>): CmpFn<T> {
    return function cmpFn(aT, aB) {
        const a = keyFn(aT)
        const b = keyFn(aB)
        if (a < b) { return -1 }
        if (a > b) { return 1 }
        return 0
    }
}

type KeyFn<T,K> = (t: T) => K
type CmpFn<T> = (a: T, b: T) => number

type FilePaths = {

    /** The import path given to us by the {@link Plugin}. */
    // Just used for error messages, to show the invalid input(s).
    original: string

    /** Relative file path within dest dir, in POSIX file path format (using /, not \).
     * 
     * ex: `foo/bar.png`
     */
    relative: string


    /** The full path to the generated file on disk. */
    onDisk: string

    /** The relative import for the embedded file. ex: "./foo/_bar.png.ts" */
    import: string
}

const toPosix = (() => {
    let toPosix = (p: string) => p
    if (path.SEPARATOR === "\\") {
        toPosix = (p) => p.replaceAll("\\", "/")
    }
    return toPosix
})()


function relativeEmbedImport(embedFilePath: string) {
    const importUrl = embed.importMeta.url

    if (importUrl.startsWith("file:")) {
        // Use a relative file import. (Usually just for local testing/dev.)
        // This is less fragile than a static import. (Allows relocating this git directory.)
        let dest = new URL(path.toFileUrl(path.dirname(embedFilePath)))
        let meta = new URL(importUrl)
        return path.posix.relative(dest.pathname, meta.pathname)
    }

    const jsrImport = toJsr(importUrl)
    if (jsrImport) {
        return jsrImport
    }

    // Otherwise, HTTP(S) imports are the best we can do:
    return importUrl   
}



type CompressionFormat = ConstructorParameters<typeof CompressionStream>[0]

async function compress(data: Uint8Array, compression: CompressionFormat): Promise<Uint8Array> {
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
    }

    return child === parent
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
 * A `main()` function which you can configure and call to embed files into
 * TypeScript code.
 * 
 * Supports "dev" and "build" subcommands.
 * 
 * For example, you can create an `embedder.ts` like:
 * ```ts
 * import * as embed from "./mod.ts" // NOTE: You'll use the full import path here. :)
 * 
 * let options: embed.DevOptions = {
 *     importMeta: import.meta,
 *     mappings: [{
 *          sourceDir: "static",
 *          destDir: "embed/static"
 *     }]
 * }
 * 
 * await embed.main({options})
 * ```
 * 
 * Then you can use it from your deno tasks to do a one-off build or run in
 * "dev mode".
 */
export async function main({options, args}: MainArgs) {
    const devCommand = new Command()
        .description("Runs \"dev mode\" which continually re-builds files.")
        .option("--task <string>", "Name of the task to run in dev mode", {
            default: options.mainTask ?? "start"
        })
        .action(async (cliOptions) => {
            await devMode({
                ...options,
                ...{mainTask: cliOptions.task}
            })
        })

    const buildCommand = new Command()
        .description("Just creates embedded files once, then stops.")
        .action(async () => {
            await buildOnce(options)
        })

    const mainCommand = new Command()
        .name("deno-embedder")
        .version(VERSION)
        .description("Embeds static files into TypeScript.")
        .action(() => {
            mainCommand.showHelp()
            Deno.exit(1)
        })
        .command("dev", devCommand)
        .command("build", buildCommand)
    
    await mainCommand.parse(args ?? Deno.args)
}

/** Arguments to {@link main} */
export interface MainArgs {

    /** See: {@link Options} */
    options: Options,

    /**
     * Arguments to pass to the invocation of main(). 
     * 
     * If unspecified, defaults to `Deno.args`.
     * 
     * You generally want to leave this unspecified, so that you can use your embedder.ts script with subcommands. 
     * See the example in {@link main}
     */
    args?: string[]
}


/**
 * Run your server in "dev mode", re-converting embedded files as they are changed.
 * 
 * This is expected to be the main way you generate embedded files.
 */
async function devMode(opts: Options) {
    let baseDir = dirFrom(opts.importMeta)
    let taskName = opts.mainTask ?? "start"

    let converters = opts.mappings.map( it => converterFor(baseDir, it))

    console.log("Running first convert:")
    for (let c of converters) {
        await c.clean()
        await c.convert()
    }

    console.log("Starting server:");
    (async () => {
        const cmd = new Deno.Command("deno", {
            args: ["task", taskName],
            stdout: "inherit",
        })
        const output = await cmd.output()
        const { code: statusCode} = output
        console.log(`task "${taskName}" exited with status: ${statusCode}`)
        // TODO: Clean way to shut down converters?
        Deno.exit(statusCode)
    })()

    for (let c of converters) {
        c.watch()
    }
}

/**
 * Just do one round of creating embed files.
 */
async function buildOnce(opts: Options) {
    let baseDir = dirFrom(opts.importMeta)
    let converters = opts.mappings.map( it => converterFor(baseDir, it))

    console.log("Converting files...")
    for (let c of converters) {
        await c.clean()
        await c.convert()
    }
    console.log("Done")
    
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


/** Options passed to {@link main} via {@link MainArgs} */
export interface Options {
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

/**
 * Backward-compatble type alias for {@link Options}.
 * 
 * @deprecated use {@link Options} instead.
 */
export type DevOptions = Options;

function dirFrom(meta: ImportMeta) {
    let url = new URL(meta.url)
    let thisFile = path.fromFileUrl(url)
    return path.dirname(thisFile)
}