import type { Converter } from "../converters/types.ts";
import type { DenoBundle } from "../mod.ts";

import { $, type Path } from "@david/dax"
import { SimpleConverter } from "../simple/converter.ts";


type Config = Omit<DenoBundle, "type"> & {
    rootDir: string
}


export class DenoBundleConverter implements Converter {
    #config: Config

    constructor(config: Config) {
        this.#config = config
    }
    
    async convert(): Promise<void> {
        await denoBundle(this.#config)

        // Since we generated this directory, don't check it in:
        await this.#outDir.join(".gitignore").writeText("*")

        // TODO: Generate simple dir:
        const sc = new SimpleConverter({
            rootDir: this.#outDir.resolve().toString()
        })
        await sc.convert()
    }
    watch(): Promise<void> {
        throw new Error("Method not implemented.");
    }

    async clean(): Promise<void> {
        await this.#outDir.emptyDir()
    }

    get #outDir() {
        const rootDir = $.path(this.#config.rootDir)
        const outDir = rootDir.join(this.#config.outDir)
        return outDir
    }
}

async function denoBundle(config: Config) {
    const rootDir = $.path(config.rootDir)
    const srcDir = rootDir.resolve(config.sourceDir)
    const destDir = rootDir.resolve(config.outDir)

    if (!await srcDir.exists()) {
        throw new Error(`Source directory does not exist: ${srcDir.toString()}`)
    }
    await destDir.mkdir({recursive: true})

    const {entrypoints, sourceMap} = config

    // `deno bundle` gives poor error messages for missing files.
    // Throw our own errors:
    for (const entrypoint of entrypoints) {
        const path = srcDir.resolve(entrypoint)
        if (!await path.exists()) {
            throw new Error(`Entrypoint does not exist: ${path}`)
        }
    }

    // `deno bundle` has nicer output if we operate from here:
    const cwd = rootDir
    // So we use relative paths from there:
    const relEntrypoints = entrypoints.map(it => relFrom(cwd, srcDir.resolve(it)))


    const command = [
        "deno", "bundle",
        "--platform", "browser",
        "--outdir", relFrom(cwd, destDir),
        "--code-splitting",
    ]
    if (sourceMap) {
        command.push(`--sourcemap=${sourceMap}`)
    }
    const minify = config.minify ?? (
        // By default, minify if sourceMap is enabled:
        !!sourceMap
    )
    if (minify) {
        command.push(`--minify`)
    }

    command.push(...relEntrypoints)

    const result = await $`${command}`.cwd(cwd).noThrow()
    if (result.code != 0) {
        // "Deno bundle" can give a "no such file or directory" error, but doesn't mention WHICH file
        // or directory. So show the command we ran so users have a chance of figuring it out.
        throw new Error(`Exit code ${result.code} from command: ${JSON.stringify(command)} in cwd: ${cwd}`)
    }
}

function relFrom(source: Path, dest: Path): string {
    // Path.relative() for some reason returns "" if the paths are the same!? 
    return source.relative(dest) || "."
}

