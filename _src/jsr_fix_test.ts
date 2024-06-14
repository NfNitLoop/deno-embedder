import {assertEquals} from "jsr:@std/assert"
import { toJsr } from "./jsr_fix.ts";

Deno.test(function jsrImports() {
    assertEquals(toJsr(`https://foo.com/bar.ts`), null)
    assertEquals(toJsr(`https://jsr.io/@nfnitloop/deno-embedder/1.3.1/embed.ts`), `jsr:@nfnitloop/deno-embedder@1.3.1/embed.ts`)
})