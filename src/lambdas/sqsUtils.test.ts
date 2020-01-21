import {getBackoffTimeout} from "./events/sqsUtils";
import * as chai from "chai";

describe.only("sqsUtils", () => {
    it("getExponential Backoff", () => {
        for (let receivedCount = 1; receivedCount < 10; receivedCount++) {
            let max = Math.pow(2, receivedCount) * 5;
            for (let j = 0; j < 100; j++) {
                const backoff = getBackoffTimeout(receivedCount);
                chai.assert.isAtMost(backoff, max);
            }
        }
    });
});