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
        const reset = resetDb();
        router.route(testUtils.authRoute);
        initializeSecretEncryptionKey(Promise.resolve("secret123") /* todo */);
        installAuthedRestRoutes(router);
        await reset;
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
        chai.assert.isEmpty(res.failedWebhookIds);
        chai.assert.isEmpty(res.deliveredWebhookIds);
    }).timeout(10000);

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
        chai.assert.sameMembers(res.deliveredWebhookIds, [webhook.id]);
        chai.assert.isEmpty(res.failedWebhookIds);
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
        chai.assert.isEmpty(res.failedWebhookIds);
        chai.assert.sameMembers(res.deliveredWebhookIds, [webhook.id, create2.body.id]);
        chai.assert.isNotNull(callbackStub.secondCall);
        chai.assert.isNull(callbackStub.thirdCall);
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
        chai.assert.isEmpty(res.failedWebhookIds);
        chai.assert.isEmpty(res.deliveredWebhookIds);
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
        chai.assert.isEmpty(res.failedWebhookIds);
        chai.assert.isEmpty(res.deliveredWebhookIds);
        chai.assert.isNull(callbackStub.firstCall);
    });

    it("returns FAILED status and empty deliverWebhookIds list on non-2XX response code", async () => {
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
                statusCode: 302,
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
        chai.assert.sameMembers(res.failedWebhookIds, [webhook.id]);
        chai.assert.isEmpty(res.deliveredWebhookIds);
        chai.assert.isNotNull(callbackStub.firstCall);
        chai.assert.isNull(callbackStub.secondCall);
        sinonSandbox.restore();
    });

    it("doesn't re-call already delivered webhookIds - call to second webhook again fails", async () => {
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
                statusCode: 404,
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
            deliveredWebhookIds: [webhook.id]
        };

        const res = await processLightrailEvent(event);
        chai.assert.sameMembers(res.failedWebhookIds, [create2.body.id]);
        chai.assert.sameMembers(res.deliveredWebhookIds, [webhook.id]);
        chai.assert.isNotNull(callbackStub.firstCall);
        chai.assert.isNull(callbackStub.secondCall);
        sinonSandbox.restore();
    });
}).timeout(10000);