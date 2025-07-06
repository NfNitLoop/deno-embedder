#!/usr/bin/env -S deno run --check

// This file is just used by jsx_test.ts to examine the embedded file's contents.

import genDir from "./generated/dir.ts"

if (import.meta.main) {
    const file = await genDir.load("app.js")
    const text = await file.text()
    console.log(text)
}