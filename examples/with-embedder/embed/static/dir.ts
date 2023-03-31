import {D, G} from "../../../../embed.ts"
import f0 from "./Smiley.svg_.ts"
import f1 from "./index.html_.ts"

const files = {
  "Smiley.svg": f0,
  "index.html": f1,
} as const

export const dir = D(files)
export const get = G(files)