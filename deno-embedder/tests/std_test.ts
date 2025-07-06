import {assertEquals, assertNotEquals} from "jsr:@std/assert";
import {
    resolve as winResolve,
    normalize as winNormalize,
    join as winJoin,
    relative as winRelative
} from "jsr:@std/path/windows";

// Oddly, resolve/normalize behavior seems to be  undocumented in the Deno docs:
Deno.test("resolve two absolute", () => {
    let result = winResolve("C:\\foo\\bar", "C:\\baz")
    assertEquals("C:\\baz", result)
})

Deno.test("resolve one absolute", () => {
    let result = winResolve("C:\\foo\\bar\\..\\baz")
    assertEquals("C:\\foo\\baz", result)
})

Deno.test("resolve one relative", () => {
    let result = winResolve("foo\\bar\\..\\baz")
    
    // Note: "resolve" uses CWD. Don't want that:
    assertNotEquals("foo\\baz", result)
})

Deno.test("normalize one relative", () => {
    let result = winNormalize("foo\\bar\\..\\baz")
    assertEquals("foo\\baz", result)
})

Deno.test("join relative", () => {
    let result = winJoin("foo\\bar", "..\\baz")

    // Note: join also normalizes:
    assertEquals("foo\\baz", result)
})

Deno.test("join absolute", () => {
    let result = winJoin("c:\\foo\\bar", "c:\\baz")

    // Note: While join normalizes, it doesn't resolve absolutes:
    assertEquals("c:\\foo\\bar\\c:\\baz", result)
})

Deno.test("relative", () => {
    let result = winRelative("C:\\foo\\bar", "c:\\foo\\baz")
    
    assertEquals("..\\baz", result)
})