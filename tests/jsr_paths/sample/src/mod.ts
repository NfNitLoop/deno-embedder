// import { Embeds } from "../../../../embed.ts";
import embeds from "./embedded/dir.ts"

async function main() {
    await showFile("foo bar.ts")
    await showFile("foobar_.d.ts_.ts")
    await showFile("foo bar/baz etc.md")
}

type FileName = Parameters<(typeof embeds)["load"]>[0]

async function showFile(fileName: FileName) {
    const file = await embeds.load(fileName)
    const text = await file.text()

    console.log("===", fileName, "===")
    console.log(text)
    console.log()
}

if (import.meta.main) {
    await main()
}