import * as cassava from "cassava";
import * as testUtils from "../../utils/test/testUtils";
import {defaultTestUser, generateId, resetDb} from "../../utils/test/testUtils";
import {initializeSecretEncryptionKey} from "../rest/webhookSecretUtils";
import * as chai from "chai";
import {installAuthedRestRoutes} from "../rest/installAuthedRestRoutes";
import * as sinon from "sinon";
import {LightrailEvent} from "./model/LightrailEvent";
import * as eventSender from "./eventSender";
import {processEvent} from "./eventProcessor";

describe("eventProcessor", function() {
    this.timeout(5000);
    const router = new cassava.Router();
    const sinonSandbox = sinon.createSandbox();

    before(async function () {
        const reset = resetDb();
        router.route(testUtils.authRoute);
        initializeSecretEncryptionKey(Promise.resolve({SecretString: "secret"}));
        installAuthedRestRoutes(router);
        await reset;
    });

    after(() => {
        sinonSandbox.restore();
    });

    const defaultEvent: LightrailEvent = {
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

    it("can process event that has no matching subscriptions. results in DELETE", async () => {
        sinonSandbox.restore();
        sinonSandbox.stub(eventSender, "sendEvent")
            .onFirstCall().resolves({
            failedWebhookIds: [],
            deliveredWebhookIds: []
        });
        const res = await processEvent(defaultEvent, now);
        chai.assert.deepEqual(res, {action: "DELETE"});
    });

    it("can process event that has 1 matching subscription that is successfully delivered. results in DELETE", async () => {
        sinonSandbox.restore();
        sinonSandbox.stub(eventSender, "sendEvent")
            .onFirstCall().resolves({
            failedWebhookIds: [],
            deliveredWebhookIds: ["webhook-1"]
        });
        const res = await processEvent(defaultEvent, now);
        chai.assert.deepEqual(res, {action: "DELETE"});
    });

    it("can process event that has 1 matching subscription that is unsuccessfully delivered. results in BACKOFF", async () => {
        sinonSandbox.restore();
        sinonSandbox.stub(eventSender, "sendEvent")
            .onFirstCall().resolves({
            failedWebhookIds: ["webhook-1"],
            deliveredWebhookIds: []
        });
        const res = await processEvent(defaultEvent, now);
        chai.assert.deepEqual(res, {action: "BACKOFF"});
    });

    it("can process event that has 1 matching subscription that is unsuccessfully delivered after 3 days of trying. results in DELETE", async () => {
        sinonSandbox.restore();
        sinonSandbox.stub(eventSender, "sendEvent")
            .onFirstCall().resolves({
            failedWebhookIds: ["webhook-1"],
            deliveredWebhookIds: []
        });
        const res = await processEvent(defaultEvent, now - 259200000 - 1 /* 3 days and 1 ms */);
        chai.assert.deepEqual(res, {action: "DELETE"});
    });

    it("can process event that has 2 matching subscriptions where one is successfully delivered and one fails. results in a REQUEUE so that the successfully delivered webhook isn't called again", async () => {
        sinonSandbox.restore();
        sinonSandbox.stub(eventSender, "sendEvent")
            .onFirstCall().resolves({
            failedWebhookIds: ["webhook-1"],
            deliveredWebhookIds: ["webhook-2"]
        });

        const event = JSON.parse(JSON.stringify(defaultEvent));
        const res = await processEvent(event, now);

        chai.assert.deepEqual(res, {action: "REQUEUE", newMessage: LightrailEvent.toSQSSendMessageRequest({...event, deliveredWebhookIds: ["webhook-2"]}, 30)});
    });

    it("can process event that has 2 matching subscriptions where one has already been delivered and the other still fails. results in a BACKOFF", async () => {
        sinonSandbox.restore();
        sinonSandbox.stub(eventSender, "sendEvent")
            .onFirstCall().resolves({
            failedWebhookIds: ["webhook-1"],
            deliveredWebhookIds: ["webhook-2"]
        });
        const event = JSON.parse(JSON.stringify(defaultEvent));
        event.deliveredWebhookIds = ["webhook-2"];

        const res = await processEvent(event, now);
        chai.assert.deepEqual(res, {action: "BACKOFF"});
    });
});