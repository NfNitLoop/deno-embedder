Example: With Embedder
======================

The main benefits here when compared to [the version without Deno Embedder][1]
are that:

 * Static files are embedded as .ts files, like the rest of your Deno code.
 * They'll be included in the output of `deno compile` and installed with
   `deno install`.
 * No `--allow-read` access necessary in your application.  
   (Though, of course, Deno Embedder itself will need read and write access
   to translate the files into their embedded versions.)


But additionally, we've added:

 * ESBuild bundling of TypeScript code! 🎉

[1]: ../without-embedder/


Running
-------

You can run this example in a few ways: 

1. For local development, run `deno task dev` from this directory.

2. You can also just:
   `deno run jsr:@nfnitloop/deno-embedder/examples/with-embedder`


3. Check out this dir and run `deno task compile` to build a self-contained
   executable, then run that.