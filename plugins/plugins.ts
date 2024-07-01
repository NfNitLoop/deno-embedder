// TODO: Is the doc lint going to warn me about the lack of module docs here?

/**
 * Tyeps of plugins supported by deno-embedder.
 *
 * Currently, only {@link WholeDirPlugin} is supported, but we may add other
 * plugin types in the future.
 */
export type Plugin = WholeDirPlugin

/**
 * A plugin that knows how to convert a whole directory of files.
 * 
 * This is appropriate for any system that must convert a directory as a whole
 * (ex: Javascript builds that need to load local dependencies)
 */
export interface WholeDirPlugin {

    /** Marker to help disambiguate {@link Plugin} type. */
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
 * Arguments passed to {@link WholeDirPlugin.convert}
 */
export interface ConvertArgs {
    /** The absolute path of the source directory. */
    sourceDir: string

    /** The absolute path of the destination directory. */
    destDir: string

    /**
     * Callback to emit a single file.
     * 
     * The Plugin's must call this for each file it generates.
     * 
     * It should await the Promise that is returned.
     */
    emit: FileEmitter
}

/** Callback that must be passed to {@link ConvertArgs} */
export type FileEmitter = (args: FileEmitterArgs) => Promise<void>

/** Arguments for {@link FileEmitter} */
export interface FileEmitterArgs {
    /**
     * The relative path name of the file to embed.
     * 
     * Example: `foo.txt` or `foo/bar.png`
     */
    file: string,

    /**
     * The raw bytes of the file.
     */
    contents: Uint8Array
}