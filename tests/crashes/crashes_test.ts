/**
 * Sometimes when rebuilding sources in dev mode fails, the main `embedder dev` process
 * can crash, but will leave the process that it spawned running. (!!!)
 * 
 * We need to make sure to clean that up. 
 * 
 * @module
 */

import { exists } from "jsr:@std/fs"
import {delay} from "jsr:@std/async"
import {assert} from "jsr:@std/assert"

const lockFile = "sample/lock"
const sampleProject = "sample"

const testFile = "sample/static/example.ts"
const exampleCode = `
export default function greet() {
    console.log("Hello, world!")
}
`.trim()

Deno.test(async function crashTest() {
    if (await exists(lockFile)) {
        console.warn("Lock file already exists.")
        await Deno.remove(lockFile)
    }

    await Deno.writeTextFile(testFile, exampleCode)

    const cmd = new Deno.Command("deno", {
        args: ["task", "dev"],
        cwd: sampleProject
    })
    await using proc = cmd.spawn()
    let status: Deno.CommandStatus|null = null
    proc.status.then((s) => {
        status = s
    })

    await retry("Lock file should have been created.", async () => {
        return await exists(lockFile)
    })
    assert(!status, "Process should still be running")

    // Now let's break the file
    console.log("Writing invalid typescript")
    await Deno.writeTextFile(testFile, exampleCode + "}")

    // deno-lint-ignore require-await
    await retry("Embedder should crash due to invalid TS.", async () => {
        return status != null
    })

    // If this hasn't been cleaned up, then the inner process is still running.
    assert(!(await exists(lockFile)), "Lock file should be cleaned up")
})

async function retry(message: string, cb: () => Promise<boolean>) {
    for (let i = 1; i < 5; i++) {
        if (await cb()) { return }
        console.log("retry() waiting...")
        await delay(1000)
    }

    // Last try:
    if (!await cb()) {
        throw new Error("awaiting condition failed: " + message)
    }
}