#!/usr/bin/env -S deno run -A

/**
 * @module
 * run `deno lint` on the package exports.
 */

import * as path from "jsr:@std/path"
import * as jsonc from "jsr:@std/jsonc"
import { z } from "npm:zod"
import { $ } from "jsr:@david/dax"

async function main() {
    const projectRoot = path.dirname(import.meta.dirname!)
    const text = await Deno.readTextFile(path.join(projectRoot, "deno.jsonc"))
    const json = jsonc.parse(text)
    const denoJson = DenoJson.parse(json)

    const files = Object.entries(denoJson.exports).map(it => it[1])

    const result = await $`deno doc --lint ${files}`.printCommand().noThrow()
    return result.code
}

const DenoJson = z.object({
    "exports": z.record(z.string(), z.string())
})

if (import.meta.main) {
    Deno.exit(await main())
}