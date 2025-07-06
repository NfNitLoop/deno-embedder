const myImport = () => import("./example_import.ts")
const module = await myImport()
module.greet()