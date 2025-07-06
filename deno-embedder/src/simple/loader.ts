/**
 * This module is used by deno-embedder to load the files you have embedded.
 * 
 * You just import a {@link Directory} like this:
 * 
 * ```ts ignore
 * import staticFiles from "./your/static/dir.ts"
 * ```
 * 
 * @module
 */

import type * as types from "../embedTypes.ts"

/**
 * Shortcut for `new Directory`
 */
export default function D<FilePath extends string>(input: Input<FilePath>): Directory<FilePath> {
    return new Directory(input)
}

/**
 * Implementation of {@link types.Directory}
 */
export class Directory<FilePath extends string> implements types.Directory<FilePath> {
    #input: Input<FilePath>
    
    /** This is a constructor. (Happy now, doc linter?) */
    constructor(input: Input<FilePath>) {
        this.#input = input
    }
    
    /** Implements {@link types.Directory.listFiles} */
    listFiles(): FilePath[] {
        return Object.keys(this.#input) as FilePath[]
    }
    
    /** Implements {@link types.Directory.load} */
    // deno-lint-ignore require-await
    async load(filePath: FilePath): Promise<types.FileHandle> {
        return new FH(this.#input[filePath])
    }
    
    /** Implements {@link types.Directory.get} */
    // deno-lint-ignore require-await
    async get(filePath: string): Promise<types.FileHandle | null> {
        const loader = this.#inputByString[filePath]
        if (!loader) {
            return null
        }
        return new FH(loader)
    }

    get #inputByString(): Record<string, BytesImporter|undefined> {
        return this.#input
    }
}

class FH implements types.FileHandle {
    #importer: BytesImporter;
    constructor(importer: BytesImporter) {
        this.#importer = importer
    }
    
    async bytes(): Promise<Uint8Array<ArrayBuffer>> {
        const {default: bytes} = await this.#importer()
        return bytes
    }
    
    async text(): Promise<string> {
        const bytes = await this.bytes()
        const decoder = new TextDecoder()
        return decoder.decode(bytes)
    }
}

/**
* Required input for {@link Directory}.
* 
* simple/converter.ts will generate this input from the directory.
*/
export type Input<FilePath extends string> = Record<FilePath, BytesImporter>

/** A function that lazily imports a module with type: "bytes". */
export type BytesImporter = {
    (): Promise<BytesModule>
}

/** The expected shape of a module imported with type="bytes" */
export type BytesModule = {
    default: Uint8Array<ArrayBuffer>
}