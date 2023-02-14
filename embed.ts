// code used by the embedded files. Should keep this small

import * as b64 from "https://deno.land/std@0.91.0/encoding/base64.ts";

// All generated files will end in this, to make sure they can't conflict
// w/ other files we may place in this directory, which won't end with this.
export const GENERATED_SUFFIX = "_.ts"

export const importMeta = import.meta

const decoder = new TextDecoder()

export class File {
    readonly size: number
    #encodedBytes: string;
    #compression: string|undefined;

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

        let bytes = b64.decode(this.#encodedBytes)
        if (this.#compression) {
            bytes = await decompress(bytes, this.#compression)
        }
        this.#decodedBytes = bytes
        this.#encodedBytes = "" // maybe release garbage.
        return bytes
    }

    async text() {
        if (this.#cachedText === undefined) {
            this.#cachedText = decoder.decode(await this.bytes())
        }
        return this.#cachedText
    }
    #cachedText: undefined|string = undefined

}

/**
 * Utility functions for looking up files in this directory.
 */
export class Directory {
    // Until TypeScript 5.0's const generics, we lose "as const" specificity here:
    constructor(readonly contents: DirectoryContents) {}

    find(pathName: string): File|Directory|null {
        return this.flatMap.get(pathName) ?? null
    }

    findFile(name: string) {
        let obj = this.find(name)
        if (obj instanceof File) return obj
        return null
    }

    findDir(name: string) {
        let obj = this.find(name)
        if (obj instanceof Directory) return obj
        return null
    }

    // recursively map all file paths.
    private get flatMap(): Map<string,File|Directory> {
        if (this.#flatMap !== undefined) { return this.#flatMap }
        this.#flatMap = new Map()
        for (let [name, obj] of Object.entries(this.contents)) {
            this.#flatMap.set(name, obj)
            if (obj instanceof Directory) {
                for (let [innerName, innerObj] of obj.flatMap) {
                    this.#flatMap.set(`${name}/${innerName}`, innerObj)
                }
            }
        }

        return this.#flatMap
    }
    #flatMap: Map<string,File|Directory> | undefined = undefined
}

export type DirectoryContents = Record<string, File|Directory>

/**
 * The data we expect to find inside *_.ts files.
 */
interface FileMeta {
    size: number

    // The base-64 encoded representation:
    encoded: string

    compression?: string

    // TODO: sha256, modified time, etc.
}

// Shortcuts to save on file size:
export function F(opts: FileMeta) { return new File(opts) }
export function D(opts: DirectoryContents) { return new Directory(opts) }

async function decompress(data: Uint8Array, compression: string): Promise<Uint8Array> {
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