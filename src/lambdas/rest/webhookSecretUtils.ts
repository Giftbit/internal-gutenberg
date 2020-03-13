import * as crypto from "crypto";
import * as cryptojs from "crypto-js";
import {GetSecretValueResponse} from "aws-sdk/clients/secretsmanager";
import {WebhookSecret} from "../../db/Webhook";
import * as uuid from "uuid";

const CODEBASE_ENCRYPTION_PEPPER = "yRPB2lp1dlOPCRn94N8FuCPFLb4hyNzrsA";
const SECRET_LENGTH = 16;

let encryptionKey: Promise<GetSecretValueResponse>;

export function initializeSecretEncryptionKey(secret: Promise<GetSecretValueResponse>): void {
    encryptionKey = secret;
}

export function getNewWebhookSecret(): WebhookSecret {
    return {
        id: uuid.v4(),
        secret: generateSecret(),
        createdDate: new Date().toISOString()
    };
}

export function generateSecret() {
    const ALPHANUMBERIC_CHARSET = Array.from("ABCDEFGHIJKLMNOPQRSTUBWXYZ123456789");
    const randomBytes = crypto.randomBytes(SECRET_LENGTH);
    let randomString: string = "";
    for (let i = 0; i < SECRET_LENGTH; i++) {
        randomString += ALPHANUMBERIC_CHARSET[randomBytes[i] % ALPHANUMBERIC_CHARSET.length];
    }
    return randomString;
}

export async function encryptSecret(secret: string): Promise<string> {
    if (!encryptionKey) {
        throw new Error("Secret encryption key has not been initialized.");
    }
    return cryptojs.AES.encrypt(addCodebasePepperToSecret(secret), (await encryptionKey).SecretString).toString();
}

export async function decryptSecret(encryptedSecret: string): Promise<string> {
    if (!encryptionKey) {
        throw new Error("Secret encryption key has not been initialized.");
    }
    const bytes = cryptojs.AES.decrypt(encryptedSecret.toString(), (await encryptionKey).SecretString);
    const decryptedCodeWithCodebasePepper = bytes.toString(cryptojs.enc.Utf8);
    return removeCodebasePepperFromDecryptedSecret(decryptedCodeWithCodebasePepper);
}

/**
 * IMPORTANT: This is used so that if the AWS account is compromised
 * the secrets can't be decrypted without access to the codebase.
 */
function addCodebasePepperToSecret(secret: string): string {
    return secret + CODEBASE_ENCRYPTION_PEPPER;
}

function removeCodebasePepperFromDecryptedSecret(decryptedSecret: string) {
    return decryptedSecret.replace(CODEBASE_ENCRYPTION_PEPPER, "");
}
