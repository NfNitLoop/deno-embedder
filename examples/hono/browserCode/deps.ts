import confetti from "https://esm.sh/canvas-confetti@1.6.0"
export { confetti }

// Warning! There's currently a bug/missing feature in esbuild that makes 
// re-exported namespaces stick around after tree-shaking.
// So, even though this is unused, it can end up in your results. :(
// See: https://github.com/evanw/esbuild/issues/1420
// and: https://github.com/NfNitLoop/deno-embedder/issues/5
// 
// import * as preact from "https://esm.sh/preact@10.13.1"
// export { preact } 