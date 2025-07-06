import D from "@nfnitloop/deno-embedder/simple/loader"
export default D({
"Smiley.svg": ()=>import("./Smiley.svg",{with:{type:"bytes"}}),
"index.html": ()=>import("./index.html",{with:{type:"bytes"}}),
"other/file.txt": ()=>import("./other/file.txt",{with:{type:"bytes"}}),
})