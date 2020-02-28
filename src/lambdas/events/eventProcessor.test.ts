import * as cassava from "cassava";
import * as testUtils from "../../utils/test/testUtils";
import {defaultTestUser, generateId, resetDb} from "../../utils/test/testUtils";
import {initializeSecretEncryptionKey} from "../rest/webhookSecretUtils";
import * as chai from "chai";
import {installAuthedRestRoutes} from "../rest/installAuthedRestRoutes";
import * as sinon from "sinon";
import {LightrailEvent} from "./model/LightrailEvent";
import * as subsriptionHandler from "./webhookDispatcher"
import {processEvent} from "./eventProcessor";

describe("eventHandler", () => {

    const router = new cassava.Router();
    const sinonSandbox = sinon.createSandbox();

    before(async function () {
        const reset = resetDb();
        router.route(testUtils.authRoute);
        initializeSecretEncryptionKey(Promise.resolve(Promise.resolve({SecretString: "secret"})));
        installAuthedRestRoutes(router);
        await reset;
    });

    after(() => {
        sinonSandbox.restore();
    });

    const event: LightrailEvent = {
        specVersion: "1.0",
        type: "plane.created",
        source: "/gutenberg/tests",
        id: generateId(),
        time: new Date(),
        userId: defaultTestUser.userId,
        dataContentType: "application/json",
        data: {
            wings: 2,
            seats: 120,
            brand: "boeing"
        },
        deliveredWebhookIds: []
    };
    const now = (new Date).getTime();

    it("no failed or delivered webhookIds results in DELETE message request", async () => {
        sinonSandbox.restore();
        sinonSandbox.stub(subsriptionHandler, "dispatch")
            .onFirstCall().resolves({
            failedWebhookIds: [],
            deliveredWebhookIds: []
        });
        const res = await processEvent(event, now);
        chai.assert.deepEqual(res, {action: "DELETE"});
    });

    it("no failed but delivered webhookIds results in DELETE message request", async () => {
        sinonSandbox.restore();
        sinonSandbox.stub(subsriptionHandler, "dispatch")
            .onFirstCall().resolves({
            failedWebhookIds: [],
            deliveredWebhookIds: ["webhook-123"]
        });
        const res = await processEvent(event, now);
        chai.assert.deepEqual(res, {action: "DELETE"});
    });
});