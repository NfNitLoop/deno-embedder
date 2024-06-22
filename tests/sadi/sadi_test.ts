/**
 * Testing Deno's Statically-Analyzable Dynamic Imports
 * 
 * We need to know exactly which syntaxes are statically analyzable.
 * The more analysis Deno does for us, the less verbose we can make the
 * resulting code.
 * 
 * If this changes in the future, we'll want to know.
 * 
 * TL;DR: I was hoping to reduce the duplication in this pattern:
 * 
 * ```
 * const dir = {
 *    `my.png`: () => import(`./my.png_.ts`)
 * }
 * ```
 * 
 * ... But SADIs don't let us.
 * 
 * @module
 */

import * as dax from "jsr:@david/dax@0.41"
import { assertEquals, assert } from "jsr:@std/assert"

/**
 * We expect this to work, it's the base case documented by Deno, IIRC.
 */
Deno.test(async function baseCase() {
    await expectWorks("example_base.ts")
})


/**
 * ISTR this was documented (or at least well-known) to NOT work, but
 * now I see that it does. Weird edge case to support.
 */
Deno.test(async function constLiterals() {
    await expectWorks("example_consts.ts")
})

/**
 * Using vars here doesn't work, though:
 */
Deno.test(async function constVars() {
    await expectBroken("example_const_vars.ts")
})

// Nor does a single var:
Deno.test(async function constVar() {
    await expectBroken("example_const_var.ts")
})

Deno.test(async function wrappedImport() {
    await expectBroken("example_wrapped.ts")
})

// This is what we'll use, so that we can declare the import w/ a literal
// (so SADI will include it in the dependency graph), but NOT import it right now.
Deno.test(async function importClosure() {
    await expectWorks("example_closure.ts")
})


const $ = dax.build$({
    commandBuilder: new dax.CommandBuilder()
        .cwd(import.meta.dirname!)
})

async function expectWorks(fileName: string) {
    await $`deno compile ${fileName}`

    const binName = fileName.substring(0, fileName.length - 3)
    const text = await $`${"./" + binName}`.text()
    assertEquals(text, `Hello, world!`)
}

async function expectBroken(fileName: string) {
    await $`deno compile ${fileName}`

    const binName = fileName.substring(0, fileName.length - 3)
    const text = await $`${"./" + binName}`.noThrow().captureCombined().text()
    assert(text.includes("Module not found"))
}