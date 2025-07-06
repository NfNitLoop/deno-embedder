Example: With Embedder
======================

This example demonstrates:
 * Embedding static files in-place by adding a `dir.ts`.
 * Bundling code for the browser, and embedding that.
 * Re-using some of that same browser code on the server.


TODO: Rewrite me to document the benefits over "without-embedder" in the wake of the Deno 2.4 release.


Running
-------

You can run this example in a few ways: 

1. For local development, run `deno task dev` from this directory.

2. Or, to try it out without Git, you can just:  
   `deno run -N jsr:@nfnitloop/deno-embedder-example-oak`


3. Check out this dir and run `deno task compile` to build a self-contained
   executable, then run `./server`.