import {getSignatures} from "./signatureUtils";
import * as cryptojs from "crypto-js";
import * as chai from "chai";

describe("signatureUtils", () => {
    it("test generate signature", () => {
        const secret = "secret123";
        const payload = {test: "test"};
        const signature = getSignatures([secret], payload);
        console.log(signature);
        chai.assert.equal(cryptojs.SHA256(JSON.stringify(payload), secret).toString(), signature);
    });
});