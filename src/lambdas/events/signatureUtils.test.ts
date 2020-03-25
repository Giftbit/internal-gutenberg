import {getSignatures} from "./signatureUtils";
import * as chai from "chai";

describe("signatureUtils", () => {
    it("can generate single signature", () => {
        const secret = "secret123";
        const payload = {test: "test"};

        const signatures = getSignatures([secret], payload);
        chai.assert.equal(signatures, "d7bcdc650a61dfb2c28e27ccce2454a56877680f4f06f1270a764f8bacfcc161", "hard coded signature to match secret and payload");
    });

    it("can generate two signatures", () => {
        const secrets = ["sec1", "sec2"];
        const payload = {test: "test"};

        const signatures = getSignatures(secrets, payload);
        chai.assert.equal(signatures, "88814fb985a5a25dd9ada9e7eee01618b6de5e04a7c8021dcdc7183fe98ed55d,e14e7e9f827bf7ec8882b041fbe8154781a0047b770ea89b6082d3d2412ba749", "hard coded signatures to match secrets and payload");
    });
});