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
    return `jsr:${namespace}/${packageName}@${version}/${filePath}`
}