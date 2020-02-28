import {decryptSecret, encryptSecret, generateSecret, initializeSecretEncryptionKey} from "./webhookSecretUtils";
import * as chai from "chai";

describe("webhookSecretUtils", () => {

    before(async function () {
        initializeSecretEncryptionKey(Promise.resolve({SecretString: "secret"}));
    });

    it("can decrypt - test encryption method with codebase pepper and encryption secret", async () => {
        // Important: these should not be changed unless migrating
        // the CODEBASE_ENCRYPTION_PEPPER or encryption secret.
        const secret = "Y4G6GJLU8PJB8O2C";
        const secretEncrypted = "U2FsdGVkX19LrwBIKzOKTOs1ZQWuRSabKSA8birQmi/WgDzcQYekNC4nJrLuAKP80pua+mov7BqSQQgDUvWCzDvCUlwGIOH4nMsV4w11aOs=";

        const decrypted = await decryptSecret(secretEncrypted);
        chai.assert.equal(decrypted, secret);
    });

    it("can encrypt and decrypt", async () => {
        const secret = generateSecret();
        chai.assert.lengthOf(secret, 16);

        const decrypted = await decryptSecret(await encryptSecret(secret));
        chai.assert.equal(secret, decrypted);
    });
});