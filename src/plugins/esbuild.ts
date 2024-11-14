/**
 * {@link ESBuild} implements a {@link Plugin} which bundles and transpiles
 * TypeScript for use in the browser.
 * 
 * @module
 */

import * as esbuild from "npm:esbuild@0.22.0"
import { denoPlugins } from "jsr:@luca/esbuild-deno-loader@^0.11.0";


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
     * If your sources contain imports to remote URLs, this will bundle them
     * into the local files so that no remote connections are necessary when
     * running the code.
     * 
     * This internally enables <https://github.com/lucacasonato/esbuild_deno_loader>
     * to do the caching/loading.
     * 
     * However, you may need to disable this to work around
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
