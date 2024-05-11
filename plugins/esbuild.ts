import * as esbuild from "npm:esbuild@0.21.1"
import { denoPlugins } from "jsr:@luca/esbuild-deno-loader@^0.10.3";


import type { ConvertArgs, WholeDirPlugin } from "./plugins.ts"

/**
 * Runs ESBuild on files before embedding them with ts-embed.
 * 
 * This lets you write TypeScript/TSX which gets bundled and embedded
 * automatically.
 */
export class ESBuild implements WholeDirPlugin {
    readonly pluginType: "whole-dir" = "whole-dir"

    #entryPoints: string[]
    #platform: esbuild.Platform
    #format: esbuild.Format
    #bundleRemoteSources: boolean

    constructor(args: Args) {
        this.#entryPoints = args.entryPoints
        this.#platform = args.platform ?? "browser"
        this.#format = args.format ?? "esm"  
        this.#bundleRemoteSources = args.bundleRemoteSources ?? true
    }

    async convert(args: ConvertArgs): Promise<void> {
        let {destDir, sourceDir, emit} = args

        let plugins = []
        if (this.#bundleRemoteSources) {
            plugins.push(...denoPlugins())
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
            write: false,
            outdir: destDir,
            plugins
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
        esbuild.stop()
    }

}

export interface Args {
    /**
     * The javascript file(s) that get loaded by your web application.
     */
    // Note: Not supporting auto-entrypoint discovery. 
    // If we were to make every file in the directory an entrypoint,
    // it would make most code unable to be tree-shaken.
    entryPoints: string[]

    // Default: "browser"
    platform?: esbuild.Platform

    // Default: "esm"
    format?: esbuild.Format

    /**
     * If your sources contain imports to remote URLs, this will bundle them
     * into the local files so that no remote connections are necessary when
     * running the code.
     * 
     * Default: true
     */
    bundleRemoteSources?: boolean
}
