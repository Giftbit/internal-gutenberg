import * as crypto from "crypto";

const ALPHANUMBERIC_CHARSET = Array.from("ABCDEFGHIJKLMNOPQRSTUBWXYZ123456789");

export function generateRandomString(length: number) {
    const randomBytes = crypto.randomBytes(length);
    let randomString: string = "";
    for (let i = 0; i < length; i++) {
        randomString += ALPHANUMBERIC_CHARSET[randomBytes[i] % ALPHANUMBERIC_CHARSET.length];
    }
    return randomString;
}