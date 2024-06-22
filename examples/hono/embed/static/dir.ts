import {E} from "../../../../embed.ts"

export default E({
  "Smiley.svg": () => import("./Smiley.svg_.ts"),
  "index.html": () => import("./index.html_.ts"),
})
