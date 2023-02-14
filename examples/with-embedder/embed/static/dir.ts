import {F, D} from "../../../../embed.ts"
import f0 from "./Smiley.svg_.ts"
import f1 from "./index.html_.ts"

export const contents = {
  "Smiley.svg": F(f0),
  "index.html": F(f1),
} as const

export const dir = D(contents)