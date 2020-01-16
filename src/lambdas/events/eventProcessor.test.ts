import * as cassava from "cassava";
import * as testUtils from "../../utils/test/testUtils";
import {generateId, resetDb} from "../../utils/test/testUtils";
import {initializeSecretEncryptionKey} from "../rest/webhookSecretUtils";
import {installTestCallbackRest} from "./test/testCallback";
import {Webhook} from "../../db/Webhook";
import * as chai from "chai";
import {sendDataToCallback} from "./callbackUtils";
import {installAuthedRestRoutes} from "../rest/installAuthedRestRoutes";

describe("eventProcessor", () => {

    const router = new cassava.Router();

    before(async function () {
        router.route(testUtils.authRoute);
        initializeSecretEncryptionKey(Promise.resolve("secret123") /* todo */);
        installAuthedRestRoutes(router);
        installTestCallbackRest(router);
        await resetDb();
    });

    it.only("happy path", async () => {
        const webhook: Partial<Webhook> = {
            id: generateId(),
            url: "https://localhost:8080/tests/callback/success",
            events: ["*"],
            active: true,
        };
        const create = await testUtils.testAuthedRequest<Webhook>(router, "/v2/webhooks", "POST", webhook);
        chai.assert.equal(create.statusCode, 201);

        const test = await sendDataToCallback("rsetdf", "http://localhost:8080/tests/callback/success", {})
        console.log(JSON.stringify(test));

    });
});