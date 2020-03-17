import {getBackoffTimeout} from "./sqsUtils";
import * as chai from "chai";

describe("sqsUtils", function () {

    it("can get exponential backoff", () => {
        for (let receivedCount = 1; receivedCount < 20; receivedCount++) {
            const max = Math.pow(2, receivedCount) * 15;
            for (let j = 0; j < 1; j++) {
                const backoff = getBackoffTimeout(receivedCount);
                chai.assert.isAtMost(backoff, max);
            }
        }
    });
});