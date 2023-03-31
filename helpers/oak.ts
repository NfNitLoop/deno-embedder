/** 
 * Helper methods to easily serve embedded static files from Oak.
 * 
 * @module
 */
import { lookup } from "https://deno.land/x/media_types@v2.10.2/mod.ts";
import * as _oak from "https://deno.land/x/oak@v9.0.1/mod.ts";
import { Directory } from "../embed.ts";

/**
 * Re-exported `oak` so you can depend on it to make sure you use the same version.
 * 
 * If you prefer another version, you may use an import map to rewrite the
 * version used here. (But beware that if Oak changes interfaces, things may break!)
 */
export const oak = _oak

/**
 * Add an entry to `router` to serve static files.
 * 
 * Ex: `serveDir(router, "/static/", staticFiles.dir)`
 */
export function serveDir(router: _oak.Router, urlPath: string, dir: Directory) {
    if (!urlPath.endsWith("/")) {
        throw new Error(`URL Path must end with "/":  ${urlPath}`)
    }

    let routePath = `${urlPath}:pathPart(.*)`
    router.get(routePath, async (ctx) => {
        let filePath = ctx.params.pathPart
        if (filePath === undefined) {
            throw new Error("Expected to find pathPart, but was undefined")
        }
        await serveFile(ctx, dir, filePath)
    })
}

/**
 * Serve a single file from a directory, with the correct mime type.
 * 
 * Ex: `serveFile(ctx, staticFiles.dir, "foo/bar.txt")`
 */
export async function serveFile(ctx: _oak.Context, dir: Directory, filePath: string) {
    let file = await dir.get(filePath)
    if (!file) {
        return // 404
    }

    let mimeType = lookup(filePath)
    if (mimeType) {
        ctx.response.headers.set("Content-Type", mimeType)
    }
    ctx.response.body = await file.bytes()
}