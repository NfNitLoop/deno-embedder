// adapted from https://jsr.io/@hono/hono/4.4.7/src/adapter/deno/serve-static.ts
import type {
  ServeStaticOptions,
  Env,
  MiddlewareHandler,
} from "../deps/hono.ts";
import { serveStatic as baseServeStatic } from "../deps/hono.ts";
import type { File, Embeds } from "../embed.ts";

export const serveStatic = <
  T extends Record<string, File>,
  E extends Env = Env
>(
  options: Omit<ServeStaticOptions<E>, "root"> & { root: Embeds<T> }
): MiddlewareHandler => {
  const { root, ...rest } = options;
  return async function serveStatic(c, next) {
    const getContent = async (path: string) => {
      try {
        const file = await root.get(path);
        return file ? file.bytes() : null;
      } catch (e) {
        console.warn(`${e}`);
        return null;
      }
    };
    return baseServeStatic({
      ...rest,
      getContent,
    })(c, next);
  };
};
