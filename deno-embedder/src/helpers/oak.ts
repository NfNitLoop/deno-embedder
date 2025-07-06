/** 
 * Helper methods to easily serve embedded static files from Oak.
 * 
 * @module
 */
import * as oak from "@oak/oak"
import type { Context as OakContext, Router as OakRouter } from "@oak/oak"
import type { Directory } from "../embedTypes.ts"

import { typeByExtension } from "@std/media-types"
import { extname } from "@std/path"

/**
 * Re-exported `oak` so you can depend on it to make sure you use the same version.
 * 
 * If you prefer another version, you may use an import map to rewrite the
 * version used here. (But beware that if Oak changes interfaces, things may break!)
 */
export { oak }
// `deno doc --lint` isn't happy with the above, so we also have to export top-level types. Boo.
export type { OakRouter, OakContext }

/**
 * Add an entry to `router` to serve static files.
 * 
 * Ex: `serveDir(router, "/static/", staticFiles)`
 */
export function serveDir(router: oak.Router, urlPath: ServerDirPath, embeds: Directory): void {
    if (!urlPath.endsWith("/")) {
        throw new Error(`URL Path must end with "/":  ${urlPath}`)
    }

    let routePath = `${urlPath}:pathPart(.*)`
    router.get(routePath, async (ctx, next) => {
        let filePath = ctx.params.pathPart
        if (filePath === undefined) {
            throw new Error("Expected to find pathPart, but was undefined")
        }
        await serveFile(ctx, embeds, filePath, next)
    })
}

/**
 * The URL Path you want to serve this directory as.
 * 
 * Must start & end with slashes. ex: `/foo/`
 */
export type ServerDirPath = "/" | `/${string}/`

/**
 * Serve a single file from a directory, with the correct mime type.
 * 
 * Ex: `serveFile(ctx, staticFiles.dir, "foo/bar.txt")`
 */
export async function serveFile(
    ctx: oak.Context,
    embeds: Directory,
    filePath: string,
    next?: () => Promise<unknown>,
): Promise<unknown> {
    let file = await embeds.get(filePath)
    if (!file) {
        if (next) {
            return next()
        }
        return // 404
    }

    let mimeType = lookup(filePath)
    if (mimeType) {
        ctx.response.headers.set("Content-Type", mimeType)
    }
    ctx.response.body = await file.bytes()
}

function lookup(filePath: string) {
    const ext = extname(filePath)
    return typeByExtension(ext)
}
