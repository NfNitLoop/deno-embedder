const path = "./"
const file = "example_import.ts"
const module = await import(path + file)
module.greet()