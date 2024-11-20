/**
 * Deno-Embedder will try to auto-detect a deno.jsonc file and set up JSX imports
 * according to its configuration.
 *
 * 
 * @module
 */

import {$} from "jsr:@david/dax@0.42.0"
import {assert} from "jsr:@std/assert"

Deno.test(async function jsxTest() {
    $.setPrintCommand(true)
    const cwd = import.meta.dirname!
    
    await $`./embedder.ts build`.cwd(cwd)
    const {stdout} = await $`./show_file.ts`.cwd(cwd).captureCombined()

    assert(stdout.includes("function MyApp("))
    
    // We've configured *preact* not react.
    assert(!stdout.includes("React.createElement("), "Should not be using React")
    assert(stdout.includes("preact.module.js"))

    // Preact symbols get minimized, unlike React.createElement (above), so we can't rely on knowing the name here.
    // TODO: Why?
    // BUT, we can see the element getting initialized like with this pattern:
    assert(stdout.includes("(MyApp, {})"))
})



