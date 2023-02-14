// May extend this type to allow different kinds of plugins in the future.
export type Plugin = WholeDirPlugin

/**
 * A plugin that knows how to convert a whole directory of files.
 * 
 * This is appropriate for any system that must convert a directory as a whole
 * (ex: Javascript builds that need to load local dependencies)
 */
export interface WholeDirPlugin {
    readonly pluginType: "whole-dir"

    /**
     * Called to convert the directory's contents.
     * 
     * This will be called once at startup, and again each time changes are
     * detected in the source directory.
     */
    convert(args: ConvertArgs): Promise<void>
}

/**
 * Arguments passed to WholeDirPlugin.convert()
 */
export interface ConvertArgs {
    // The absolute path of the source directory.
    sourceDir: string

    // The absolute path of the destination directory.
    destDir: string

    /**
     * Callback to emit a single file.
     * 
     * The Plugin must call this for each file it wishes to emit.
     * It should await the Promise that is returned.
     */
    emit: FileEmitter
}

export type FileEmitter = (args: FileEmitterArgs) => Promise<void>

export interface FileEmitterArgs {
    /**
     * The name of the file to emit.
     * 
     * If this is a relative path, it will be resolved inside of `destDir`.
     * 
     * You may not attempt to emit a file outside of `destDir`.
     */
    file: string,

    contents: Uint8Array
}