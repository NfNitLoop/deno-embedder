/** Can convert from one directory to another. */
export type Converter = {
    /** Do one convert */
    convert(): Promise<void>

    /**
     * Watch for changes and convert files as needed.
     * Not defined whether this is incremental or whole-directory.
     */
    watch(): Promise<void>

    /**
     * Clean up the output directory for a fresh generate.
     */
    clean(): Promise<void>
}