/// <reference lib="dom" />

/**
 * Code in this module is used by embedded files/directories. You should not
 * rely on it directly.
 * 
 * @module
 */

import {decodeBase64} from "./deps/std/encoding/base64.ts";

// Hmm. For some reason DecompressionStream is in scope, but not CompressionFormat?
type CompressionFormat = ConstructorParameters<typeof DecompressionStream>[0]


// This is a type, not a var. It's used in a JSDoc {@link} below.
// deno-lint-ignore no-unused-vars
import type { Mapping } from "./mod.ts"

// All generated files will end in this, to make sure they can't conflict
// w/ other files we may place in this directory, which won't end with this.
export const GENERATED_SUFFIX = "_.ts"

export const importMeta = import.meta

const decoder = new TextDecoder()

/**
 * Represents the contents of a file that's been embedded into TypeScript.
 */
export class File {
    readonly size: number
    #encodedBytes: string;
    #compression: CompressionFormat | undefined;

    constructor(meta: FileMeta) {
        this.size = meta.size
        // Only decode bytes as necessary to save memory/time at startup:
        this.#encodedBytes = meta.encoded
        this.#compression = meta.compression
    }

    #decodedBytes: Uint8Array | undefined = undefined
    async bytes(): Promise<Uint8Array> {
        if (this.#decodedBytes !== undefined) {
            return this.#decodedBytes
        }

        let bytes = decodeBase64(this.#encodedBytes)
        if (this.#compression) {
            bytes = await decompress(bytes, this.#compression)
        }
        this.#decodedBytes = bytes
        this.#encodedBytes = "" // maybe release garbage.
        return bytes
    }

    /**
     * Parse the bytes as utf-8 text.
     */
    async text(): Promise<string> {
        if (this.#cachedText === undefined) {
            this.#cachedText = decoder.decode(await this.bytes())
        }
        return this.#cachedText
    }
    #cachedText: undefined|string = undefined

}

/**
 * Embedder stores each file in its own _.ts file, and then lists them all in
 * an object of this type:
 */
type EmbedImports = Readonly<Record<string, File>>



/**
 * The data we expect to find inside embedded *_.ts files.
 */
interface FileMeta {
    size: number

    // The base-64 encoded representation:
    encoded: string

    compression?: CompressionFormat

    // TODO: sha256, modified time, etc.
}

/** Shortcut for `new File(opts)` */
export function F(opts: FileMeta) { return new File(opts) }

async function decompress(data: Uint8Array, compression: CompressionFormat): Promise<Uint8Array> {
    let input = new Blob([data])
    let ds = new DecompressionStream(compression)
    let stream = input.stream().pipeThrough(ds)

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

/**
 * Makes a type-safe get() function for a dir.ts.
 * 
 * You'll be able to call get(fileName), and the file names will be type-checked
 * by TypeScript.
 */
export function G<T extends Record<string, File>>(files: T): (filePath: keyof T) => Promise<File> {
    // This may one day require async for dynamic imports, so we'll require it
    // now:
    // deno-lint-ignore require-await
    let fn = async (filePath: keyof T) => {
        return files[filePath]
    }
    return fn
}

/**
 * Allows accessing all files embedded by a {@link Mapping}.
 * 
 * Each `dir.ts` in your Mapping `destDir` exposes an instance
 * of this class as its default export.
 */
export class Embeds<T extends Record<string, File>> {
    #embeds: T

    constructor(embeds: T) {
        this.#embeds = embeds
    }

    /**
     * Type-safe method to load a known embed file.
     * 
     * If you know you need a particular embed at compile time, using this method
     * lets TypeScript check that you have specified a correct (existing) file
     * path.
     */
    // May eventually require async, so using async now:
    // deno-lint-ignore require-await
    async load(filePath: keyof T): Promise<File> {
        return this.#embeds[filePath]
    }

    /**
     * Method to do runtime loading of a file.
     * 
     * If you're loading user-specified file paths, use this method. It will
     * return `null` if no such file exists.
     */
    // May eventually require async, so using async now:
    // deno-lint-ignore require-await
    async get(filePath: string): Promise<File|null> {
        return this.#embeds[filePath] ?? null
    }
}

/** Shortcut for `new Embeds(embeds)` */
export function E<T extends Record<string, File>>(embeds: T): Embeds<T> {
    return new Embeds(embeds)
}