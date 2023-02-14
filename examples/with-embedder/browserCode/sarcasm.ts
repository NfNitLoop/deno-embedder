// This code can be used locally (i.e.: server-side) and in the browser, thanks
// to the ESBuild plugin. :)

export default function sarcasm(text: string) {
    // Probably not unicode-safe, just a dumb function to demo.
    let out = ""
    for (let i = 0; i<text.length; i++) {
        let letter = text[i]
        if (randomBool()) {
            letter = letter.toUpperCase()
        } else {
            letter = letter.toLowerCase()
        }
        out += letter
    }
    return out
}

function randomBool() { return Math.random() >= 0.5 }

