import {assertEquals, assertNotEquals} from "https://deno.land/std@0.177.0/testing/asserts.ts";
import * as winPath from "https://deno.land/std@0.177.0/path/win32.ts";

// Oddly, resolve/normalize behavior seems to be  undocumented in the Deno docs:
Deno.test("resolve two absolute", () => {
    let result = winPath.resolve("C:\\foo\\bar", "C:\\baz")
    assertEquals("C:\\baz", result)
})

Deno.test("resolve one absolute", () => {
    let result = winPath.resolve("C:\\foo\\bar\\..\\baz")
    assertEquals("C:\\foo\\baz", result)
})

Deno.test("resolve one relative", () => {
    let result = winPath.resolve("foo\\bar\\..\\baz")
    
    // Note: "resolve" uses CWD. Don't want that:
    assertNotEquals("foo\\baz", result)
})

Deno.test("normalize one relative", () => {
    let result = winPath.normalize("foo\\bar\\..\\baz")
    assertEquals("foo\\baz", result)
})

Deno.test("join relative", () => {
    let result = winPath.join("foo\\bar", "..\\baz")

    // Note: join also normalizes:
    assertEquals("foo\\baz", result)
})

Deno.test("join absolute", () => {
    let result = winPath.join("c:\\foo\\bar", "c:\\baz")

    // Note: While join normalizes, it doesn't resolve absolutes:
    assertEquals("c:\\foo\\bar\\c:\\baz", result)
})

Deno.test("relative", () => {
    let result = winPath.relative("C:\\foo\\bar", "c:\\foo\\baz")
    
    assertEquals("..\\baz", result)
})