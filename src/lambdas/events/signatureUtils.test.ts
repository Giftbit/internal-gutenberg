import {getSignatures} from "./signatureUtils";
import * as cryptojs from "crypto-js";
import * as chai from "chai";

describe("signatureUtils", () => {
    it("test generate single signature", () => {
        const secret = "secret123";
        const payload = {test: "test"};

        const signatures = getSignatures([secret], payload);
        chai.assert.equal(cryptojs.SHA256(JSON.stringify(payload), secret).toString(), signatures);
        chai.assert.equal(signatures, "3e80b3778b3b03766e7be993131c0af2ad05630c5d96fb7fa132d05b77336e04", "hard coded signature to match secret and payload");
    });

    it("test generate two signatures", () => {
        const secrets = ["sec1", "sec2"];
        const payload = {test: "test"};

        const signatures = getSignatures(secrets, payload);
        chai.assert.equal(signatures, "3e80b3778b3b03766e7be993131c0af2ad05630c5d96fb7fa132d05b77336e04,3e80b3778b3b03766e7be993131c0af2ad05630c5d96fb7fa132d05b77336e04", "hard coded signatures to match secrets and payload")
    });
});