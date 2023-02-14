deno-embedder
=============

Deno Embedder is a tool to make developing and distributing [Deno] applications
easier when you need access to static files (ex: .txt, .png, etc.) at runtime.

[Deno]: https://deno.land/

Main Features
-------------

 * "Dev mode" for quick development
 * Files are embedded within plain TypeScript (`.ts`) files.
   * No need for `--allow-net` or `--allow-read` permissions to load them!
   * You can `deno compile` the resulting app (or users can `deno install` it) 
     and all your static file dependencies will be present.
 * Automatic (gzip) compression for file types that benefit from it.
 * Type-safe access to your files. (i.e.: File name typos are
   found by the type checker)
 * A find() method for runtime file lookup.
 * Plugins for modifying files before embedding them, if needed.
 * Plugin for bundling static client-side code with ESBuild.
   * Write TypeScript, run it in the browser.
   * Can use the same TypeScript file in the browser and Deno (provided you 
     don't use Deno-specific )
   * Any remote dependencies of your code are *automatically* bundled,
     efficiently and quickly from the Deno cache.
 * Utility for easily serving files from [Oak].

 [Oak]: https://github.com/oakserver/oak#readme

Quick Start
-----------

If you just want to see an example project to follow, take a look at
[examples/with-embedder](./examples/with-embedder/).



