// Thanks to https://github.com/jed/esbuild-plugin-http-fetch for a good pattern
// to follow here!  :) 

import * as esbuild from 'https://deno.land/x/esbuild@v0.17.5/mod.js'
import { createCache } from "https://deno.land/x/deno_cache@0.4.1/mod.ts";

export {esbuild}


const PLUGIN_NAME = 'deno-cache'

/**
 * Fetches external files from the deno cache so you don't need to re-download
 * them all the time.
 */
export class Plugin implements esbuild.Plugin {
    name = PLUGIN_NAME
    async setup({onResolve, onLoad}: esbuild.PluginBuild): Promise<void> {
        
        // When in "file" namespace, if we see something for https, switch
        // to our plugin namespace:
        onResolve({filter: /^https:\/\//}, claimImport)

        // It seems like applying a namespace to an import transitively
        // makes ITS imports come to us, too.
        // See: https://esbuild.github.io/plugins/#http-plugin:~:text=We%20also%20want%20to%20intercept%20all%20import%20paths%20inside%20downloaded

        // Once operating in our namespace, we may see relative imports.
        // Resolve these paths to a full URL.
        onResolve({filter: /.*/, namespace: PLUGIN_NAME}, resolvePath)

        // By here, we'll always have a URL `path`, just load it from Deno Cache.
        onLoad({filter: /.*/, namespace: PLUGIN_NAME}, loadSource)
    }
}

function claimImport({path}: esbuild.OnResolveArgs) {
    return {
        path,
        namespace: PLUGIN_NAME
    }
}

function resolvePath({path, importer}: esbuild.OnResolveArgs){
    return {
        path: new URL(path, importer).href,
        namespace: PLUGIN_NAME
    }
}

const denoCache = createCache()

async function loadSource({path}: esbuild.OnLoadArgs): Promise<esbuild.OnLoadResult> {
    let cached = await denoCache.load(path)
    if (cached === undefined) {
        throw new Error(`Could not load: ${path}`)
    }
    if (cached.kind != "module") {
        throw new Error(`Expected to load a module, but got ${cached.kind} for ${path}`)
    }

    // TODO: esbuild-plugin-http-fetch has a thing that modifies the source code
    // if it has comments about sourceMaps.  Do we need that? Why?
    
    return {
        contents: cached.content,
        loader: getLoader(path)
    }
}

const ALLOWED_LOADERS: esbuild.Loader[] = ['js','ts','tsx','jsx','json','css','text','binary','base64','dataurl','file','copy']
const DEFAULT_LOADER = "ts"

function getLoader(sourceUrl: string): esbuild.Loader {
    let {pathname} = new URL(sourceUrl)
    let match = pathname.match(/[^.]+$/)
    if (!match) { return DEFAULT_LOADER }

    let suffix = match[0]
    if(!(ALLOWED_LOADERS as string[]).includes(suffix)){
        return DEFAULT_LOADER
    }
    return suffix as esbuild.Loader
}
