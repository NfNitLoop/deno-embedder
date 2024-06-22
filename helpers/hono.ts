/**
 * Utilities for using deno-embedder with [Hono](https://hono.dev).
 * 
 * @module
 */

// adapted from https://jsr.io/@hono/hono/4.4.7/src/adapter/deno/serve-static.ts
import type {
    ServeStaticOptions,
    Env,
    MiddlewareHandler,
    Hono
} from "../deps/hono.ts";
import { serveStatic as baseServeStatic } from "../deps/hono.ts";
import type { Embeds } from "../embed.ts";

/**
 * A version of Hono's [serveStatic] which serves embedded files.
 * 
 * Note: You likely want to specify `rewriteRequestPath` if your full URL path
 * doesn't match the relative path within the directory of embedded files.
 * The [`serveDir`] function provides a simpler interface.
 * 
 * [serveStatic]: https://hono.dev/docs/getting-started/deno#serve-static-files
 */
export function serveStatic<E extends Env = Env>(
    options: Omit<ServeStaticOptions<E>, "root"> & { root: Embeds }
): MiddlewareHandler {
    const { root, ...rest } = options;
    return function serveStatic(c, next) {
        const getContent = async (path: string) => {
            try {
                const file = await root.get(path);
                return file ? file.bytes() : null;
            } catch (e) {
                console.warn(`${e}`);
                return null;
            }
        };
        
        // note: baseServeStatic gives us mime type headers automatically. Nice.
        return baseServeStatic({
            ...rest,
            getContent,
        })(c, next);
    };
};

/**
 * A simpler form of {@link serveStatic}.
 * 
 * ```ts
 * import myFiles from "./embeds/myFiles/dir.ts"
 * 
 * const app = new Hono()
 * serveDir(app, "/myFiles/*", myFiles)
 * ```
 */
// This is like the serveDir function for oak. 
export function serveDir(app: Hono, path: ServeDirPath, embeds: Embeds) {
    if (!path.startsWith("/") || !path.endsWith("/*")) {
        throw new Error(`Invalid path: "${path}". Must be of the format "/foo/*".`)
    }
    const prefix = path.substring(0, path.length - 1)
    const prefixLen = prefix.length
    const rewriteRequestPath = (path: string) => {
        return path.substring(prefixLen)
    }
    
    app.use(path, serveStatic({
        root: embeds,
        rewriteRequestPath
    }))
}

type ServeDirPath = `/${string}/*` | "/*"


// TODO: export hono from JSR package.
