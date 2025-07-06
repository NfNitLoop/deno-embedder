import { recursiveReadDir } from "../lib/util.ts";
import type { Converter } from "../converters/types.ts";
import * as path from "@std/path"

export type Args = {
    rootDir: string
}

const DIR_FILE = "dir.ts"

export class SimpleConverter implements Converter {
    #rootDir: string

    constructor({rootDir}: Args) {
        this.#rootDir = rootDir
    }


  async convert(): Promise<void> {
    let files = []
    for await (const entry of recursiveReadDir(this.#rootDir)) {
        if (entry.isDirectory) { continue }
        if (entry.isSymlink) { continue }
        const baseName = path.basename(entry.name)
        if (baseName.toLowerCase() == DIR_FILE) {
            continue
        }
        files.push(entry.name)
    }


    files = files.map(toPosix)
    files.sort()

    const dirFile = path.join(this.#rootDir, DIR_FILE)
    await Deno.writeTextFile(dirFile, dirTs(files))
  }
  watch(): Promise<void> {
    throw new Error("watch() not implemented.");
  }
  async clean(): Promise<void> {
    // Nothing to clean. We always just overwrite dir.ts.
  }

}

function dirTs(files: string[]) {
    const lines = [
        `import D from "@nfnitloop/deno-embedder/simple/loader"`,
        `export default D(${sadiMap(files)})`,
    ]
    return lines.join("\n")
}

function sadiMap(files: string[]) {
    const lines = [ '{' ]
    for (const file of files) {
        lines.push(`${quote(file)}: ${sadiFn(file)},`)
    }
    lines.push('}')
    return lines.join("\n")
}

function sadiFn(fileName: string): string {
    // Note, as of Deno 2.4.0, you can not relocate the {with:types:"bytes"}}
    // into a const. (This makes sense, needs to be statically analyzable).

    return `()=>import(${quote("./" + fileName)},{with:{type:"bytes"}})`
}

function quote(value: string) {
    checkFileName(value)
    return '"' + value + '"'
}


function checkFileName(name: string) {
    // These are unsafe to embed in a JS `string`:
    if (name.match(/["\\]/)) {
        throw new Error(`Unsafe File name: ${name}`)
    }
}


const toPosix = (() => {
    let toPosix = (p: string) => p
    if (path.SEPARATOR === "\\") {
        toPosix = (p) => p.replaceAll("\\", "/")
    }
    return toPosix
})()