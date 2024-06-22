async function myImport(path: string) {
    return await import(path)
}
const module = await myImport("./example_import.ts")
module.greet()