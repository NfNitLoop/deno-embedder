import {E} from "../../../../../src/embed.ts"

export default E({
  "foo bar.ts": () => import("./_foo_bar.ts.ts"),
  "foo bar/baz etc.md": () => import("./foo_bar/_baz_etc.md.ts"),
  "foo bar/baz.txt": () => import("./foo_bar/_baz.txt.ts"),
  "foobar_.d.ts_.ts": () => import("./_foobar_.d_ts_.ts.ts"),
})
