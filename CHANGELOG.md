1.6.0
=====
Released: Nov. 20, 2024

* ESBuild Plugin:
  * Auto-detect some TypeScript compilerOptions from a project's deno.json[c] file.  
    So far, this is just `jsx` and `jsxImportSource`. Please open an issue if you'd like more.

1.5.0
=====

 * Upgrade the ESBuild plugin to use jsr:@luca/esbuild-deno-loader@^0.11.0. (auto-detects import maps.)

1.4.0
=====

Released: Jun 21, 2024

* Improved: Embedded files are now loaded lazily, when first used, instead of at startup.  
  See: <https://github.com/NfNitLoop/deno-embedder/issues/6>
* New: Hono middlerware!  
  See: <https://github.com/NfNitLoop/deno-embedder/issues/12>
* Dev: Add lint checks to `deno task test`.

1.3.0
=====

Add the `plugins` option to the ESBuild plugin.

1.2.1
=====

Now supports embedding imports from JSR. 🎉

1.2.0
=====

Publishing to JSR.

1.0.0
=====

Released: March 31, 2023

* ⚠️ Breaking API changes.  
  Lots of work here to really simplify and minimize the API surface area.
* More documentation.
* Better tests.
* Laid groundwork for dynamic imports.  
  More APIs are async, so that they won't have to change if/when dynamic module
  loading is added. This is currently blocked. 
  See: <https://github.com/NfNitLoop/deno-embedder/issues/6>


0.9.x
=====

Initial brainstorm version. It works!