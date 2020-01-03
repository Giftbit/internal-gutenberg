import * as crypto from "crypto";
import * as cryptojs from "crypto-js";

const CODEBASE_ENCRYPTION_PEPPER = "yRPB2lp1dlOPCRn94N8FuCPFLb4hyNzrsA";

let encryptionKey: Promise<string>;

export function initializeSecretEncryptionKey(secret: Promise<string>): void {
    encryptionKey = secret;
}

export function generateSecret(length: number) {
    const ALPHANUMBERIC_CHARSET = Array.from("ABCDEFGHIJKLMNOPQRSTUBWXYZ123456789");
    const randomBytes = crypto.randomBytes(length);
    let randomString: string = "";
    for (let i = 0; i < length; i++) {
        randomString += ALPHANUMBERIC_CHARSET[randomBytes[i] % ALPHANUMBERIC_CHARSET.length];
    }
    return randomString;
}

export async function encryptSecret(secret: string): Promise<string> {
    if (!encryptionKey) {
        throw new Error("Secret encryption key has not been initialized.");
    }
    return cryptojs.AES.encrypt(addCodebasePepperToSecret(secret), await encryptionKey).toString();
}


export async function decryptSecret(secretEncrypted: string): Promise<string> {
    if (!encryptionKey) {
        throw new Error("Secret encryption key has not been initialized.");
    }
    const bytes = cryptojs.AES.decrypt(secretEncrypted.toString(), await encryptionKey);
    const decryptedCodeWithCodebasePepper = bytes.toString(cryptojs.enc.Utf8);
    return removeCodebasePepperFromDecryptedSecret(decryptedCodeWithCodebasePepper);
}

/**
 * IMPORTANT: This is used so that if the AWS account is compromised
 * the secrets can't be decrypted without access to the codebase.
 */
function addCodebasePepperToSecret(code: string): string {
    return code + CODEBASE_ENCRYPTION_PEPPER;
}

function removeCodebasePepperFromDecryptedSecret(decryptedCode: string) {
    return decryptedCode.replace(CODEBASE_ENCRYPTION_PEPPER, "");
}
