Example: Without Deno Embedder
==============================

Problems with this approach:

 * Your application requires `--allow-read` access to read files from
   the local `static/` directory. 
 * Those files do not get bundled into the executable created with
   `deno task compile`, or installed when users `deno install` your code.
