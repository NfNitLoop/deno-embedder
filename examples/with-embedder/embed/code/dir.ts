import {E} from "../../../../deno-embedder/src/embed.ts"

export default E({
  "app.js": () => import("./_app.js.ts"),
})
