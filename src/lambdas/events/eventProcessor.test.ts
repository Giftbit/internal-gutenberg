import * as cassava from "cassava";
import * as testUtils from "../../utils/test/testUtils";
import {defaultTestUser, generateId, resetDb} from "../../utils/test/testUtils";
import {initializeSecretEncryptionKey} from "../rest/webhookSecretUtils";
import {Webhook} from "../../db/Webhook";
import * as chai from "chai";
import * as callbackUtils from "./callbackUtils";
import {installAuthedRestRoutes} from "../rest/installAuthedRestRoutes";
import * as sinon from "sinon";
import {LightrailEvent} from "./LightrailEvent";
import {processLightrailEvent} from "./eventProcessor";

describe.only("eventProcessor", () => {

    const router = new cassava.Router();
    const sinonSandbox = sinon.createSandbox();

    before(async function () {
        router.route(testUtils.authRoute);
        initializeSecretEncryptionKey(Promise.resolve("secret123") /* todo */);
        installAuthedRestRoutes(router);
        await resetDb();
    });

    it("can process event where user has no webhooks - FINISHED", async () => {
        const event: LightrailEvent = {
            specversion: "1.0",
            type: "plane.created",
            source: "/gutenberg/tests",
            id: generateId(),
            time: new Date(),
            userid: defaultTestUser.userId,
            datacontenttype: "application/json",
            data: {
                wings: 2,
                seats: 120,
                brand: "boeing"
            }
        };

        const res = await processLightrailEvent(event);
        chai.assert.equal(res.status, "FINISHED");
    });

    it("can process event where user has 1 matching webhook - FINISHED", async () => {
        sinonSandbox.restore();
        await resetDb();
        const webhook: Partial<Webhook> = {
            id: generateId(),
            url: "https://localhost:8080/tests/callback/success",
            events: ["*"],
            active: true,
        };
        const create = await testUtils.testAuthedRequest<Webhook>(router, "/v2/webhooks", "POST", webhook);
        chai.assert.equal(create.statusCode, 201);

        const callbackStub = sinonSandbox.stub(callbackUtils, "sendDataToCallback")
            .onFirstCall().resolves({
                statusCode: 200,
                headers: null,
                body: {}
            });

        const event: LightrailEvent = {
            specversion: "1.0",
            type: "plane.created",
            source: "/gutenberg/tests",
            id: generateId(),
            time: new Date(),
            userid: defaultTestUser.userId,
            datacontenttype: "application/json",
            data: {
                wings: 2,
                seats: 120,
                brand: "boeing"
            }
        };

        const res = await processLightrailEvent(event);
        chai.assert.equal(res.status, "FINISHED");
        chai.assert.isNotNull(callbackStub.firstCall);
        chai.assert.isNull(callbackStub.secondCall);
    });

    it("can process event where user has 2 matching webhooks - FINISHED", async () => {
        sinonSandbox.restore();
        await resetDb();
        const webhook: Partial<Webhook> = {
            id: generateId(),
            url: "https://localhost:8080/tests/callback/success",
            events: ["*"],
            active: true,
        };
        const create1 = await testUtils.testAuthedRequest<Webhook>(router, "/v2/webhooks", "POST", webhook);
        chai.assert.equal(create1.statusCode, 201);
        const create2 = await testUtils.testAuthedRequest<Webhook>(router, "/v2/webhooks", "POST", {
            ...webhook,
            id: generateId()
        });
        chai.assert.equal(create2.statusCode, 201);

        const callbackStub = sinonSandbox.stub(callbackUtils, "sendDataToCallback")
            .onFirstCall().resolves({
                statusCode: 200,
                headers: null,
                body: {}
            })
            .onSecondCall().resolves({
                statusCode: 299,
                headers: null,
                body: {}
            });

        const event: LightrailEvent = {
            specversion: "1.0",
            type: "plane.created",
            source: "/gutenberg/tests",
            id: generateId(),
            time: new Date(),
            userid: defaultTestUser.userId,
            datacontenttype: "application/json",
            data: {
                wings: 2,
                seats: 120,
                brand: "boeing"
            }
        };

        const res = await processLightrailEvent(event);
        chai.assert.equal(res.status, "FINISHED");
        chai.assert.isNotNull(callbackStub.secondCall);
        chai.assert.isNull(callbackStub.thirdCall);
        sinonSandbox.restore()
    });

    it("can process event where user has webhooks but non match - FINISHED", async () => {
        sinonSandbox.restore();
        await resetDb();
        const webhook: Partial<Webhook> = {
            id: generateId(),
            url: "https://localhost:8080/tests/callback/success",
            events: ["plane.updated"],
            active: true,
        };
        const create = await testUtils.testAuthedRequest<Webhook>(router, "/v2/webhooks", "POST", webhook);
        chai.assert.equal(create.statusCode, 201);

        const callbackStub = sinonSandbox.stub(callbackUtils, "sendDataToCallback")
            .onFirstCall().resolves({
                statusCode: 200,
                headers: null,
                body: {}
            });

        const event: LightrailEvent = {
            specversion: "1.0",
            type: "plane.created",
            source: "/gutenberg/tests",
            id: generateId(),
            time: new Date(),
            userid: defaultTestUser.userId,
            datacontenttype: "application/json",
            data: {
                wings: 2,
                seats: 120,
                brand: "boeing"
            }
        };

        const res = await processLightrailEvent(event);
        chai.assert.equal(res.status, "FINISHED");
        chai.assert.isNull(callbackStub.firstCall);
    });

    it("deactivated webhooks are skipped - FINISHED", async () => {
        sinonSandbox.restore();
        await resetDb();
        const webhook: Partial<Webhook> = {
            id: generateId(),
            url: "https://localhost:8080/tests/callback/success",
            events: ["*"],
            active: false,
        };
        const create = await testUtils.testAuthedRequest<Webhook>(router, "/v2/webhooks", "POST", webhook);
        chai.assert.equal(create.statusCode, 201);

        const callbackStub = sinonSandbox.stub(callbackUtils, "sendDataToCallback")
            .onFirstCall().resolves({
                statusCode: 200,
                headers: null,
                body: {}
            });

        const event: LightrailEvent = {
            specversion: "1.0",
            type: "plane.created",
            source: "/gutenberg/tests",
            id: generateId(),
            time: new Date(),
            userid: defaultTestUser.userId,
            datacontenttype: "application/json",
            data: {
                wings: 2,
                seats: 120,
                brand: "boeing"
            }
        };

        const res = await processLightrailEvent(event);
        chai.assert.equal(res.status, "FINISHED");
        chai.assert.isNull(callbackStub.firstCall);
    });

    it("returns FAILED status and failingWebhookIds on non-2XX response code", async () => {
        sinonSandbox.restore();
        await resetDb();
        const webhook: Partial<Webhook> = {
            id: generateId(),
            url: "https://localhost:8080/tests/callback/success",
            events: ["*"],
            active: true,
        };
        const create = await testUtils.testAuthedRequest<Webhook>(router, "/v2/webhooks", "POST", webhook);
        chai.assert.equal(create.statusCode, 201);

        const callbackStub = sinonSandbox.stub(callbackUtils, "sendDataToCallback")
            .onFirstCall().resolves({
                statusCode: 199,
                headers: null,
                body: {}
            });

        const event: LightrailEvent = {
            specversion: "1.0",
            type: "plane.created",
            source: "/gutenberg/tests",
            id: generateId(),
            time: new Date(),
            userid: defaultTestUser.userId,
            datacontenttype: "application/json",
            data: {
                wings: 2,
                seats: 120,
                brand: "boeing"
            },
            failedWebhookIds: []
        };

        const res = await processLightrailEvent(event);
        chai.assert.equal(res.status, "FAILED");
        chai.assert.sameMembers(res["failedWebhookIds"], [webhook.id]);
        chai.assert.isNotNull(callbackStub.firstCall);
        chai.assert.isNull(callbackStub.secondCall);
        sinonSandbox.restore();
    });

    // todo this isn't where backoff test lives.
    it("will backoff on same failingWebhookIds", async () => {
        sinonSandbox.restore();
        await resetDb();
        const webhook: Partial<Webhook> = {
            id: generateId(),
            url: "https://localhost:8080/tests/callback/success",
            events: ["*"],
            active: true,
        };
        const create = await testUtils.testAuthedRequest<Webhook>(router, "/v2/webhooks", "POST", webhook);
        chai.assert.equal(create.statusCode, 201);

        const callbackStub = sinonSandbox.stub(callbackUtils, "sendDataToCallback")
            .onFirstCall().resolves({
                statusCode: 300,
                headers: null,
                body: {}
            });

        const event: LightrailEvent = {
            specversion: "1.0",
            type: "plane.created",
            source: "/gutenberg/tests",
            id: generateId(),
            time: new Date(),
            userid: defaultTestUser.userId,
            datacontenttype: "application/json",
            data: {
                wings: 2,
                seats: 120,
                brand: "boeing"
            },
            failedWebhookIds: [webhook.id]
        };

        const res = await processLightrailEvent(event);
        chai.assert.equal(res.status, "FAILED");
        chai.assert.sameMembers(res["failedWebhookIds"], [webhook.id]);
        chai.assert.isNotNull(callbackStub.firstCall);
        chai.assert.isNull(callbackStub.secondCall);
    });

    it("will backoff on non 2xx status code - 300", async () => {
        sinonSandbox.restore();
        await resetDb();
        const webhook: Partial<Webhook> = {
            id: generateId(),
            url: "https://localhost:8080/tests/callback/success",
            events: ["*"],
            active: true,
        };
        const create = await testUtils.testAuthedRequest<Webhook>(router, "/v2/webhooks", "POST", webhook);
        chai.assert.equal(create.statusCode, 201);

        const callbackStub = sinonSandbox.stub(callbackUtils, "sendDataToCallback")
            .onFirstCall().resolves({
                statusCode: 300,
                headers: null,
                body: {}
            });

        const event: LightrailEvent = {
            specversion: "1.0",
            type: "plane.created",
            source: "/gutenberg/tests",
            id: generateId(),
            time: new Date(),
            userid: defaultTestUser.userId,
            datacontenttype: "application/json",
            data: {
                wings: 2,
                seats: 120,
                brand: "boeing"
            }
        };

        const res = await processLightrailEvent(event);
        chai.assert.equal(res.status, "FAILED");
        chai.assert.sameMembers(res["failedWebhookIds"], [webhook.id]);
        chai.assert.isNotNull(callbackStub.firstCall);
        chai.assert.isNull(callbackStub.secondCall);
    });
});