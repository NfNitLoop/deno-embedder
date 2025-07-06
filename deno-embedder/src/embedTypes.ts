/**
 * Common types for the different kinds of embedded directories.
 * 
 * Different embedding types may expose more methods than these.
 * @module
 */

/**
 * The entrypoint into a directory of embedded files.
 * 
 */
export type Directory<FilePath extends string = string> = {

    /**
     * List all files in this directory.
     * 
     * All recursive files are "flattened" into one Directory data structure, so
     * this is a recursive list of all files, and no directories.
     */
    listFiles(): FilePath[]

    /**
     * Type-safe method to load a known embed file.
     * 
     * If you know you need a particular embed at compile time, using this method
     * lets TypeScript check that you have specified a correct (existing) file
     * path.
     */
    load(filePath: FilePath): Promise<FileHandle>

    /**
     * Method to do runtime loading of a file.
     * 
     * If you're loading user-specified file paths, use this method. It will
     * return `null` if no such file exists.
     */
    get(filePath: string): Promise<FileHandle|null>
}

/**
 * A reference to an embedded file.
 */
export type FileHandle = {
    /** Get access to the raw bytes of the file. */
    bytes(): Promise<Uint8Array<ArrayBuffer>>

    /** Get the contents of the file, decoded as utf-8. */
    text(): Promise<string>
}