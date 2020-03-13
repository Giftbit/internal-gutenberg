import {postData} from "./httpUtils";
import * as chai from "chai";

describe("httpUtils", function() {
    it("call against self signed cert results in failed status code", async () => {
        const res = await postData("1234", "https://self-signed.badssl.com/", {});
        const is2xx = res.statusCode >= 200 && res.statusCode < 300;
        chai.assert.isFalse(is2xx);
    });
});