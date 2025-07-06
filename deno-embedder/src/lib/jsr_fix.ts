// ex: https://jsr.io/@nfnitloop/deno-embedder/1.3.0/embed.ts
const JSR_IMPORT = /^https:\/\/jsr.io\/(?<namespace>[^/]+)\/(?<packageName>[^/]+)\/(?<version>[^/]+)\/(?<filePath>.+)$/

/** Convert an HTTPS import to a JSR import, if we can */
export function toJsr(importUrl: string): string|null {
    const jsrImport = JSR_IMPORT.exec(importUrl)
    if (!jsrImport) { return null }

    // JSR imports get exposed via importmeta as an HTTPS URL.
    // But HTTP(S) imports aren't supported in JSR, or by `deno check`.
    // Revert to the JSR import format:
    const {namespace, packageName, version, filePath} = jsrImport.groups!

    const exportPath = HTTP_TO_EXPORT[filePath]
    if (!exportPath) {
        return null
    }

    return `jsr:${namespace}/${packageName}@${version}/${exportPath}`
}

// Oops: If we've got a package export of "foo", we don't get its path as "foo", but
// we get its actual HTTP path which might be different. So we've got to map them back.
const HTTP_TO_EXPORT: Partial<Record<string,string>> = {
    "src/embed.ts": "embed.ts"
}