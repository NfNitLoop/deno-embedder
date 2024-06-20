// You don't need this in your project. This is just me testing that 
// esbuild is working properly. 

import * as e from "./embedder.ts"


Deno.test(async function testBuildCmd(t) {
    await e.embedder.main({options: e.options, args: ["build"]})
})