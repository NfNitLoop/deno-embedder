import {E} from "../../../../src/embed.ts"

export default E({
  "Smiley.svg": () => import("./_Smiley.svg.ts"),
  "index.html": () => import("./_index.html.ts"),
})
