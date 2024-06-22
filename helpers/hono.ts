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
} from "../deps/hono.ts";
import { serveStatic as baseServeStatic } from "../deps/hono.ts";
import type { File, Embeds } from "../embed.ts";

/**
 * A version of Hono's [serveStatic] which serves embedded files.
 * 
 * Note: You likely want to specify `rewriteRequestPath` if your full URL path
 * doesn't match the relative path within the directory of embedded files.
 * The [`serveDir`] function provides a simpler interface.
 * 
 * [serveStatic]: https://hono.dev/docs/getting-started/deno#serve-static-files
 */
export const serveStatic = <
  T extends Record<string, File>,
  E extends Env = Env
>(
  options: Omit<ServeStaticOptions<E>, "root"> & { root: Embeds<T> }
): MiddlewareHandler => {
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

// TODO: serveDir().
// TODO: export hono from JSR package.
// TODO: include hono in `deno task test`.