import {assertEquals} from "jsr:@std/assert"
import { toJsr } from "./jsr_fix.ts";

Deno.test(function jsrImports() {
    assertEquals(toJsr(`https://foo.com/bar.ts`), null)

    // This is not a URL we expect to see:
    assertEquals(
        toJsr(`https://jsr.io/@nfnitloop/deno-embedder/1.3.1/embed.ts`),
        null,
    )

    // This is the one we expect:
    assertEquals(
        toJsr(`https://jsr.io/@nfnitloop/deno-embedder/1.4.9/src/embed.ts`),
        `jsr:@nfnitloop/deno-embedder@1.4.9/embed.ts`,
    )

})