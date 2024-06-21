const path = "./example_import.ts"
const module = await import(path)
module.greet()