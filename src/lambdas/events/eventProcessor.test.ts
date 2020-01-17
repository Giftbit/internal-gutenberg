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

describe("eventProcessor", () => {

    const router = new cassava.Router();
    const sinonSandbox = sinon.createSandbox();

    before(async function () {
        router.route(testUtils.authRoute);
        initializeSecretEncryptionKey(Promise.resolve("secret123") /* todo */);
        installAuthedRestRoutes(router);
        await resetDb();
    });

    it("happy path", async () => {
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
        console.log("args: " + JSON.stringify(callbackStub.firstCall.args));
        console.log(JSON.stringify(res));
    });
}).timeout(5000);