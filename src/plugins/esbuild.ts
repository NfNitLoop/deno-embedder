/**
 * {@link ESBuild} implements a {@link Plugin} which bundles and transpiles
 * TypeScript for use in the browser.
 * 
 * @module
 */

import * as esbuild from "npm:esbuild@0.22.0"
import { denoPlugins } from "jsr:@luca/esbuild-deno-loader@^0.11.0";
import * as path from "jsr:@std/path@1.0.8"
import { exists as fileExists } from "jsr:@std/fs@1"
import * as jsonc from "jsr:@std/jsonc@1.0.1";
import {z} from "npm:zod@3.23.4"


// deno-lint-ignore no-unused-vars -- Plugin is used in a @link.
import type { ConvertArgs, WholeDirPlugin, Plugin } from "./plugins.ts"

/**
 * Runs ESBuild on files before embedding them with ts-embed.
 * 
 * This lets you write TypeScript/TSX which gets bundled and embedded
 * automatically.
 * 
 * See <https://github.com/NfNitLoop/deno-embedder/blob/main/examples/with-embedder/embedder.ts>
 * for example use.
 */
export class ESBuild implements WholeDirPlugin {

    /** Implements {@link WholeDirPlugin.pluginType} */
    readonly pluginType: "whole-dir" = "whole-dir"

    #entryPoints: string[]
    #platform: esbuild.Platform
    #format: esbuild.Format
    #bundleRemoteSources: boolean
    #plugins: esbuild.Plugin[];

    /** Constructor. */
    constructor(args: Args) {
        this.#entryPoints = args.entryPoints
        this.#platform = args.platform ?? "browser"
        this.#format = args.format ?? "esm"  
        this.#bundleRemoteSources = args.bundleRemoteSources ?? true
        this.#plugins = args.plugins ?? []
    }

    /** Implements {@link WholeDirPlugin.convert} */
    async convert(args: ConvertArgs): Promise<void> {
        let {destDir, sourceDir, emit} = args

        let plugins: esbuild.Plugin[] = []
        plugins.push(...this.#plugins)
        if (this.#bundleRemoteSources) {
            plugins.push(...denoPlugins({
                loader: "native" // use the Deno cache, don't download every time.
            }))
        }

        let options = {
            // Lets source files (entryPoints) resolve relative to this dir.
            absWorkingDir: sourceDir,

            entryPoints: this.#entryPoints,

            // without bundle, local file imports won't be updated to .js.
            bundle: true, 
            splitting: true,
            platform: this.#platform,
            format: this.#format,
            write: false, // We'll further transform these in memory.
            outdir: destDir,
            plugins,
            ...(await detectDenoOptions(sourceDir))
        } as const

        // TODO: This requires holding all build results in memory.
        // Maybe build to tempdir instead?
        let build = await esbuild.build(options)

        for (let outFile of build.outputFiles) {
            await emit({
                file: outFile.path,
                contents: outFile.contents,
            })
        }

        // esbuild seems to start a long-running process.  If you don't stop
        // it, Deno waits around forever for it to finish, instead of exiting.
        await esbuild.stop()
    }

}

/** Constructor args for {@link ESBuild} */
export interface Args {
    /**
     * The javascript file(s) that get loaded by your web application.
     */
    // Note: Not supporting auto-entrypoint discovery. 
    // If we were to make every file in the directory an entrypoint,
    // it would make most code unable to be tree-shaken.
    entryPoints: string[]

    /** Default: "browser" */
    platform?: esbuild.Platform

    /** Default: "esm" */
    format?: esbuild.Format

    /**
     * If your sources contain imports of remote code (ex: jsr:*, npm:*), this will bundle them
     * into the local files so that no remote connections are necessary when
     * running the code.
     * 
     * This internally enables <https://github.com/lucacasonato/esbuild_deno_loader>
     * to do the caching/loading.
     * 
     * However, if you're embedding static files you may need to disable this to work around
     * <https://github.com/NfNitLoop/deno-embedder/issues/10>.
     * 
     * Default: true
     */
    bundleRemoteSources?: boolean

    /**
     * Additional plugins to modify sources before bundling.
     */
    plugins?: esbuild.Plugin[]
}

/** ESBuild options detected from deno config files. */
// Note: limited this type because expanding a larger type with ... breaks type inference at use site. 
type DetectedOptions = Pick<esbuild.BuildOptions, "jsx" | "jsxImportSource">

async function detectDenoOptions(sourceDir: string): Promise<DetectedOptions> {
    const denoFile = await findDenoFile(sourceDir)
    if (!denoFile) {
        return {}
    }

    return await parseDenoOptions(denoFile)
}

async function parseDenoOptions(denoFile: string): Promise<DetectedOptions> {
    const text = await Deno.readTextFile(denoFile)
    const json = jsonc.parse(text)
    const opts = DenoOptions.parse(json).compilerOptions

    let jsx: DetectedOptions["jsx"] = undefined
    if (opts?.jsx) {
        // See: https://docs.deno.com/runtime/reference/jsx/
        // And: https://esbuild.github.io/api/#jsx
        const mapToEsbuild = {
            "react": undefined,
            "react-jsx": "automatic",
        } as const

        if (opts.jsx == "precompile") {
            throw new Error(`In ${denoFile}, jsx option "precompile" is unsupported for embedding.`)
        }
        jsx = mapToEsbuild[opts.jsx]
    }
    
    return  {
        jsx,
        jsxImportSource: opts?.jsxImportSource
    }
}

const DenoOptions = z.object({
    compilerOptions: z.object({
        jsx: z.enum([
            "react",
            "react-jsx",
            "precompile",
        ]).optional(),
        jsxImportSource: z.string().optional(),
    }).optional()
})

async function findDenoFile(sourceDir: string): Promise<string|null> {
    let cwd = sourceDir;
    const files = ["deno.jsonc", "deno.json"]
    while (true) {
        for (const file of files) {
            const filePath = path.join(cwd, file)
            if (await fileExists(filePath)) {
                return filePath
            }
        }

        // `cd ..`
        const parent = path.dirname(cwd)
        if (parent == cwd) {
            return null // we reached the root
        }
        cwd = parent
    }
}

