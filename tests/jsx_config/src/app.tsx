// Example of some typical (P)React code we might want to bundle and embed.
// Note: depends on the jsx configuration in deno.jsonc to work properly.

// You *could* otherwise add JSX comments like this to get similar behavior,
// but it's a pain to do in every file.
/** @__jsxRuntime automatic */
/** @__jsxImportSource preact */


import {render} from "preact"

export function mount(el: Element) {
    render(<MyApp/>, el)
}

function MyApp() {
    return <div>
        <p>Here's some stuff</p>
    </div>
}