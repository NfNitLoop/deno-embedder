import {E} from "../../../../../embed.ts"

export default E({
  "foo bar.ts": () => import("./_foo_bar.ts.ts"),
  "foobar_.d.ts_.ts": () => import("./_foobar_.d_ts_.ts.ts"),
})
