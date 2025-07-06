import * as path from "@std/path"
import * as embed from "../embed.ts"
import { exists } from "@std/fs";
import { encodeBase64 } from "@std/encoding/base64"
import { toJsr } from "./jsr_fix.ts";


/**
 * Class that just writes embedded files to a directory.
 */
export class EmbedWriter {

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

const DIR_FILENAME = "dir.ts"


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



async function isEmptyDir(path: string) {
    for await (const _entry of Deno.readDir(path)) {
        return false
    }
    return true
}