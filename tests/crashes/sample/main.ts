#!/usr/bin/env -S deno run -RW

import {delay} from "jsr:@std/async"

const lockPath = "lock"

async function main() {
    try {
        await using _lock = await LockFile.lock(lockPath)
        console.log("Created", lockPath)
        await sleepFor(15)
        console.log("Done")
    } catch (e) {
        console.log(`Exiting: ${e}`)
        Deno.exit(1)
    }
}

async function sleepFor(seconds: number) {
    let aborting = false
    const handler = () => {
        aborting = true
    }

    const signals: Deno.Signal[] = ["SIGINT", "SIGTERM"]
    for (const signal of signals) {
        Deno.addSignalListener(signal, handler)
    }


    console.log("Sleeping for", seconds, "seconds")
    for (; seconds > 0; seconds--) {
        console.log(seconds)
        await delay(1000)
        // Turn signals into exceptions, so that Symbol.asyncDispose runs. 
        if (aborting) {
            throw new Error(`Process was killed for ${import.meta.filename}`)
        }
    }

    for (const signal of signals) {
        Deno.removeSignalListener(signal, handler)
    }
}

class LockFile {
    #released = false

    static async lock(file: string): Promise<LockFile> {
        const timestamp = new Date().toString()
        await Deno.writeTextFile(lockPath, timestamp)

        return new LockFile(file, timestamp)
    
    }
    private constructor(readonly file: string, readonly contents: string) {}

    async [Symbol.asyncDispose]() {
        await this.release()
    }

    async release() {
        if (this.#released) { return }
        this.#released = true
        console.log("Removing lockfile", this.file)
        await Deno.remove(this.file)
    }
}

if (import.meta.main) {
    await main()
}