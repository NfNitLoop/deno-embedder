deno-embedder
=============

Deno Embedder is a tool to make developing and distributing [Deno] applications
easier when you need access to static files (ex: .txt, .png, etc.) at runtime.

[Deno]: https://deno.land/

Main Features
-------------

 * Files are embedded within plain TypeScript (`.ts`) files.
   * No need for `--allow-net` or `--allow-read` permissions to load them!
   * You can `deno compile` the resulting app (or users can `deno install` it) 
     and all your static file dependencies will be present.
 * "Dev mode" for quick development
 * Automatic (gzip) compression for file types that benefit from it.
 * Plugins for modifying files before embedding them, if needed.
 * Utility for easily [serving files] from [Oak].

[serving files]: https://deno.land/x/embedder@v0.9.1/helpers/oak.ts
[Oak]: https://github.com/oakserver/oak#readme

Quick Start
-----------

If you just want to see an example project to follow, take a look at
[examples/with-embedder](./examples/with-embedder/).

API Docs can be found at: <https://deno.land/x/embedder/mod.ts>


Use
---

### Configuration ###

Create an `embedder.ts` file in the root of your project. This file will serve
as both the configuration for how to embed your files, but also a handy script
to perform the embedding.

Example:

```ts
import * as embedder from "https://deno.land/x/embedder/mod.ts"

const options = {
    importMeta: import.meta,

    mappings: [
        {
            sourceDir: "static",
            destDir: "embed/static"
        },
    ]
}

if (import.meta.main) {
    await embedder.main({options})
}
```


The `mappings` configuration tells embedder to copy files from your project's
`static` directory, convert them into data embedded in TypeScript files, and 
write them into `embed/static`.

### Dev Mode ###

Dev mode is the easiest way to develop using your static embeds. It watches
your `static` input directory and will regenerate output files any time the 
inputs change.

It will also run your deno project's "start" task, so that you can immediately
use those embedded files in your application. The easiest way to set this up
is with deno tasks.

Example:

```jsonc
// File: deno.jsonc
{
    "tasks": {
        // This task starts Deno Embedder's "Dev Mode", which will watch for
        // updates to your static files and regenerate the embedded versions
        // as necessary.
        // 
        // Permissions:
        // Deno Embedder needs read and write access to your project directory.
        // It also needs access to run processes (ex: `deno task start`).
        // It's simplest to just grant all permissions with -A:
        "dev": "deno run -A embedder.ts dev --task start",

        // Deno Embedder will call the "start" task to
        // run the server once it has created embedded versions of your files.
        // It's recommended to use --watch here so that your server will restart
        // if Deno Embedder updates the embeds.
        "start": "deno run --allow-net=0.0.0.0:8000 --watch server.ts",
    },
}
```

Now you can `deno task dev` to run both embedder and your application code.

This example runs `server.ts`, but your start task should be able to run
whatever script file is applicable to your application. You should use 
`deno`'s `--watch` option so that your app will be restarted any time the
static files are updated.

### Accessing Embedded Data ###

There are two ways to access your embedded files.

The first way gives you type-safe access to files. You'll get a TypeScript
error if you try to access an embedded file that doesn't exist:

```ts
import static from "./embed/static/dir.ts"

let readme = await static.load("readme.md")  // Type checked. No typos! :) 

console.log("readme.md:", await readme.text())
```

The second way does a runtime lookup and returns `null` if no such file exists.

```ts
import static from "./embed/static/dir.ts"

let fileName = Deno.args[0]
let file = await static.dir.get(fileName)

if (!file) {
    console.log("No such file:", fileName)
} else {
    console.log("===", fileName, "===")
    console.log(await file.text())
}
```

ESBuild Plugin
--------------

The ESBuild plugin will change the behavior of Deno Embedder to first bundle
the files in the source directory, then embed the results of that bundling.

This allows you to easily:
 * Write TypeScript, run it in the browser.
 * Use the same TypeScript file in the browser and Deno 
   (provided you don't use anything Deno-specific.)
 * Use remote dependencies in browser code.
   Any remote dependencies are *automatically* bundled, efficiently
   and quickly from the Deno cache.

See the [demo embedder.ts] file for an example.

[demo embedder.ts]: ./examples/with-embedder/embedder.ts

