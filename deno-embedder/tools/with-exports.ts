#!/usr/bin/env -S deno run -A

/**
 * Run some command and pass it the list of files exported from this deno package.
 * 
 * @module
 */

import * as path from "jsr:@std/path"
import * as jsonc from "jsr:@std/jsonc"
import { z } from "npm:zod"
import { $ } from "jsr:@david/dax"

async function main(args: string[]): Promise<number> {
    if (args.length == 0) {
        console.error("Must pass in some arguments")
        return 1
    }

    const files = await getExports()
    const result = await $`${args} ${files}`.printCommand().noThrow()
    return result.code
}

async function getExports(): Promise<string[]> {
    const projectRoot = path.dirname(import.meta.dirname!)
    const text = await Deno.readTextFile(path.join(projectRoot, "deno.jsonc"))
    const json = jsonc.parse(text)
    const denoJson = DenoJson.parse(json)

    return Object.entries(denoJson.exports).map(it => it[1])
}

const DenoJson = z.object({
    "exports": z.record(z.string(), z.string())
})

if (import.meta.main) {
    Deno.exit(await main(Deno.args))
}