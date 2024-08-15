// You don't need this in your project. This is just me testing that 
// esbuild is working properly. 

import { delay } from "../../src/deps/std/async.ts";
import * as e from "./embedder.ts"


Deno.test(async function testBuildCmd() {
    await e.embedder.main({options: e.options, args: ["build"]})
    
    // workaround https://github.com/evanw/esbuild/issues/3682
    // I'm still seeing that problem even though I'm awaiting esbuild.stop(). 🤔
    await delay(100)
})