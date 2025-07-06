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

import * as path from "@std/path";

import { Command } from "@cliffy/command";
import { StaticConverter } from "./converters/oldStatic.ts";
import { PluginConverter } from "./converters/oldPlugin.ts";
import type { Plugin } from "./plugins/plugins.ts";
import { SimpleConverter } from "./simple/converter.ts";
import { DenoBundleConverter } from "./bundle/converter.ts";


const VERSION = "1.0.0"

/**
 * Configures a mapping from an input "source" dir, to an output destination.
 */
export type Mapping = LegacyMapping | StaticDir | DenoBundle

/**
 * This type just adds a `dir.ts` entry to your existing directory of static files.
 * Each file is added as a SADI (statically-analyzable dynamic import) and will become
 * part of your project's module graph automatically.
 * 
 * You can access the directory via the {@link TODO} type.
 */
export type StaticDir = {
    type: "staticDir"

    /** 
     * Path relative to your config file/script to where your static files live.
     * We'll create `dir.ts` files here.
     */
    path: string
}

/**
 * Run `deno bundle` on some code and 
 */
export type DenoBundle = {
    type: "denoBundle"

    /**
     * Where the code for your browser is located.
     */
    sourceDir: string,

    /**
     * Where to save the bundled, embedded files.
     * 
     * Note, this directory will be emptied each time you regenerate files.
     */
    outDir: string,

    /**
     * One or more "entrypoints" into your bundled code. 
     * 
     * These are resolved relative to sourceDir.
     */
    entrypoints: [string, ...string[]]

    /**
     * Should we minify the bundled code?
     * 
     * If unspecified, we try to choose a good default.
     * If sourceMap is enabled, minify defaults to "true", since you can view the source via the map.
     * If sourceMap is not enabled, minify defaults to "false" to help with debugging.
     */
    minify?: boolean

    /**
     * Only bundling for the browser is supported at the moment. 
     * 
     * Please open an issue if you have a different use case.
     * 
     * @default "browser"
     */
    platform?: "browser"

    /**
     * If set, generate source maps for the generated code.
     */
    sourceMap?: "linked" | "inline" | "external"
}

/**
 * TODO: Old way of doing things, will probably disappear.
 */
export type LegacyMapping = {
    type?: undefined

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


function converterFor(baseDir: string, opts: Mapping) {
    if (opts.type == "staticDir") {
        return new SimpleConverter({
            rootDir: path.resolve(baseDir, opts.path)
        })
    }

    if (opts.type == "denoBundle") {
        return new DenoBundleConverter({
            ...opts,
            rootDir: baseDir
        })
    }

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
 * ```ts, ignore
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
 * await embed.main({options, args: ["build"]})
 * ```
 * 
 * Then you can use it from your deno tasks to do a one-off build or run in
 * "dev mode".
 */
export async function main({options, args}: MainArgs) {
    // TODO: Switch away from cliffy? Development is pretty stagnant recently...
    const devCommand = new Command()
        .description("Runs \"dev mode\" which continually re-builds files.")
        .option("--task <string>", "Name of the task to run in dev mode", {
            default: options.mainTask ?? "start"
        })
        .action(async (cliOptions) => {
            const code = await devMode({
                ...options,
                ...{mainTask: cliOptions.task}
            })
            Deno.exit(code)
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
async function devMode(opts: Options): Promise<number> {
    let baseDir = dirFrom(opts.importMeta)
    let taskName = opts.mainTask ?? "start"

    let converters = opts.mappings.map( it => converterFor(baseDir, it))

    console.log("Running first convert:")
    for (let c of converters) {
        await c.clean()
        await c.convert()
    }

    console.log("Starting server:");

    const cmd = new Deno.Command("deno", {
        args: ["task", taskName],
    })
    await using proc = cmd.spawn()
    const mainTaskFinished = async () => {
        const status = await proc.status
        const msg = `task "${taskName}" exited with status: ${status.code}`
        if (status.code == 0) {
            console.log(msg)
            return
        }
        throw new Error(msg)
    }

    let promises = [mainTaskFinished(), ...converters.map(c => c.watch())]

    // If this resolves, there was either an error in one of the converters, or the main server task finished.
    let code = 0
    try {
        await Promise.race(promises)
    } catch (e) {
        console.log(e)
        code = 1
    }
    console.log("Exiting dev mode.")
    return code
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