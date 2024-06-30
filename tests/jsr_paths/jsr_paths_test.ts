/** 
 * See: <https://github.com/NfNitLoop/deno-embedder/issues/15>
 * 
 * > JSR disallows some file patterns.
 * >  * No spaces in filenames.
 * >  * Filenames may not contain .d.ts, even in the middle.
 * 
 * Test that we don't run into those.
 * 
 * @module
 */

import * as dax from "jsr:@david/dax@0.41"
import { assertStringIncludes, assertNotEquals } from "jsr:@std/assert"

const $ = dax.build$({
    commandBuilder: new dax.CommandBuilder()
        .cwd(import.meta.dirname!)
        .printCommand()
})

Deno.test(async function jsrPathErrorSpaces() {
    const result = await $`cd spaces_error && deno publish --dry-run --allow-dirty`
        .noThrow()
        .captureCombined()

    assertNotEquals(result.code, 0)
    assertStringIncludes(result.combined, "error[invalid-path]")
    assertStringIncludes(result.combined, "package path must not contain whitespace")
})

Deno.test(async function jsrPathErrorDTs() {
    const result = await $`cd typescript_error && deno publish --dry-run --allow-dirty`
        .noThrow()
        .captureCombined()

    assertNotEquals(result.code, 0)
    assertStringIncludes(result.combined, "TS1183")
    assertStringIncludes(result.combined, "[ERROR]")

    // It appears to be *tsc* trying to interpret this file, even though it doesn't end with .d.ts.  🤯
    assertStringIncludes(result.combined, "An implementation cannot be declared in ambient contexts.")
})

Deno.test(async function jsrPathTest() {
    const $$ = await cd($, "sample")

    await $$`deno run -A embedder.ts build`

    
    // .d.ts*.ts files cause errors here, even though they don't *end* with .d.ts.
    await $$`deno check src/mod.ts`
    // Even `deno run` doesn't deal with importing .d.ts*.ts files:
    await $$`deno run src/mod.ts`


    // Files with spaces cause issues here:
    await $$`deno publish --dry-run --allow-dirty`
})


async function cd ($: dax.$Type, relativePath: string) {
    const absPath = await $`cd ${relativePath} && pwd`.text()
    return $.build$({
        commandBuilder: new dax.CommandBuilder().cwd(absPath).printCommand()
    })
}