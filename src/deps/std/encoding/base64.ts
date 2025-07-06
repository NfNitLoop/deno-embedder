import {decodeBase64 as upstream} from "jsr:@std/encoding@0.224.0/base64"
export { encodeBase64 } from "jsr:@std/encoding@0.224.0/base64"

// Fix type. (v1.0 has a breaking change to encoding/decoding.)
export function decodeBase64(value: string): Uint8Array<ArrayBuffer> {
    return upstream(value) as Uint8Array<ArrayBuffer>
}

