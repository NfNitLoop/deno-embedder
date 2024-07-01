/**
 * Code in this module is used by embedded files/directories. You should not
 * rely on it directly.
 * 
 * @module
 */

import {decodeBase64} from "./deps/std/encoding/base64.ts";



// This is a type, not a var. It's used in a JSDoc {@link} below.
// deno-lint-ignore no-unused-vars
import type { Mapping } from "./mod.ts"

/** Used internally so that deno-embedder can generate embed files that properly import this module. */
export const importMeta: ImportMeta = import.meta

/** Import information we expose via {@link importMeta} */
export type ImportMeta = {
    readonly url: string
}

const decoder = new TextDecoder()

/**
 * Represents the contents of a file that's been embedded into TypeScript.
 */
export class File {
    /** Size of the embedded file in bytes (uncomrpessed/unencoded) */
    readonly size: number

    /** May be compressed */
    #contents: {bytes: Uint8Array, compression: CompressionFormat | undefined }


    /** Called (indirectly) by each embedded file. */
    constructor(meta: FileMeta) {
        this.size = meta.size
        // We now use dynamic imports, so we're specifically importing this file due to a request.
        // Eagerly decode base64 into bytes so we can GC the inefficient encoding.
        this.#contents = {
            bytes: decodeBase64(meta.encoded),
            compression: meta.compression
        }
    }

    /** Returns the raw bytes of the embedded file. */
    async bytes(): Promise<Uint8Array> {
        let {bytes, compression} = this.#contents

        // Decompress on first use:
        if (compression) {
            bytes = await decompress(bytes, compression)
            compression = undefined
            this.#contents = { bytes, compression}
        }

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
 * The data we expect to find generated embedded files.
 */
export interface FileMeta {
    /** Size of the embedded file (uncomrpessed/unencoded) */
    size: number

    /** 
     * The base-64 encoded representation of the file.
     * 
     * Note: One benefit of passing this to a TypeScript function/object is that
     * we can immediately decode it, and save on 33% of the base64 encoding cost
     * in memory. (after GC)
     */
    encoded: string

    /** If specified, how the bytes of this file are compressed. */
    compression?: CompressionFormat

    // TODO: sha256, modified time, etc.
}

/** Valid compression formats for embedded files. */
export type CompressionFormat = ConstructorParameters<typeof DecompressionStream>[0]


/** Shortcut for `new File(opts)` */
export function F(opts: FileMeta): File { return new File(opts) }

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

/** Each embedded file is of this shape. It has a default export that gives us a File object. */
export type FileModule = {
    default: File
}

/** A function that we can call to import a file module. */
export type FileModuleImporter = () => Promise<FileModule>

/** We expect the embed file to pass this into Embeds. */
export type EmbedsDef<K extends string> = Record<K, FileModuleImporter>

/**
 * Allows accessing all files embedded by a {@link Mapping}.
 * 
 * Each `dir.ts` in your Mapping `destDir` exposes an instance
 * of this class as its default export.
 */
export class Embeds<K extends string = string> {
    #embeds: EmbedsDef<K>

    /**
     * Called (indirectly) by a `dir.ts` file to register its contents.
     */
    constructor(embeds: EmbedsDef<K>) {
        this.#embeds = embeds
    }

    /**
    * Returns a list of embed file keys.
    * 
    * This method can be used to retrieve the keys of the embed files for 
    * iteration or other purposes.
    */
    list(): Array<K> {
        return Object.keys(this.#embeds) as Array<K>;
    }

    /**
     * Type-safe method to load a known embed file.
     * 
     * If you know you need a particular embed at compile time, using this method
     * lets TypeScript check that you have specified a correct (existing) file
     * path.
     */
    async load(filePath: K): Promise<File> {
        const importer = this.#embeds[filePath]
        const module = await importer()
        return module.default
    }

    /**
     * Method to do runtime loading of a file.
     * 
     * If you're loading user-specified file paths, use this method. It will
     * return `null` if no such file exists.
     */
    async get(filePath: string): Promise<File|null> {
        const importer = this.#embeds[filePath as K]
        if (!importer) { return null }

        const module = await importer()
        return module.default
    }
}

/** 
 * Called by a `dir.ts` file to register its contents.
 * 
 * Shortcut for the constructor for {@link Embeds} */
export function E<K extends string>(embeds: EmbedsDef<K>): Embeds<K> {
    return new Embeds(embeds)
}
