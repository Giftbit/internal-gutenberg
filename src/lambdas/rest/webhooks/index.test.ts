import * as testUtils from "../../../utils/testUtils/index";
import {defaultTestUser} from "../../../utils/testUtils/index";
import {generateId, resetDb} from "../../../utils/testUtils";
import * as chai from "chai";
import * as cassava from "cassava";
import {Webhook} from "../../../db/Webhook";
import {installAuthedRestRoutes} from "../installAuthedRestRoutes";
import {ParsedProxyResponse} from "../../../utils/testUtils/ParsedProxyResponse";
import {TestUser} from "../../../utils/testUtils/TestUser";

describe("webhooks", () => {

    const router = new cassava.Router();

    before(async function () {
        router.route(testUtils.authRoute);
        installAuthedRestRoutes(router);
        await resetDb();
    });

    it("can create a webhook", async () => {
        const webhook: Partial<Webhook> = {
            id: generateId(),
            url: "https://www.example.com/hooks",
            events: ["*"],
            active: true,
        };
        const create = await testUtils.testAuthedRequest<Webhook>(router, "/v2/webhooks", "POST", webhook);
        chai.assert.equal(create.statusCode, 201);
        chai.assert.deepInclude(create.body, webhook);
        chai.assert.isNotEmpty(create.body.secrets);
        console.log(create.body.secrets);

        const get = await testUtils.testAuthedRequest<Webhook>(router, `/v2/webhooks/${webhook.id}`, "GET");
        chai.assert.equal(get.statusCode, 200);
        chai.assert.deepInclude(get.body, webhook);

        const list = await testUtils.testAuthedRequest<Webhook[]>(router, `/v2/webhooks`, "GET");
        chai.assert.equal(list.statusCode, 200);
        chai.assert.deepInclude(list.body[0], webhook);
    });

    it("can't create a webhook if it already exists - 409", async () => {
        const webhook: Partial<Webhook> = {
            id: generateId(),
            url: "https://www.example.com/hooks",
            events: ["*"],
            active: true,
        };
        const create = await testUtils.testAuthedRequest<Webhook>(router, "/v2/webhooks", "POST", webhook);
        chai.assert.equal(create.statusCode, 201);
        chai.assert.deepInclude(create.body, webhook);

        const createAgain = await testUtils.testAuthedRequest<Webhook>(router, "/v2/webhooks", "POST", webhook);
        chai.assert.equal(createAgain.statusCode, 409);
    });

    it("can't get a webhook that doesn't exist - 404", async () => {
        const get = await testUtils.testAuthedRequest<Webhook>(router, `/v2/webhooks/${generateId()}`, "GET");
        chai.assert.equal(get.statusCode, 404);
    });

    it("can update a webhook", async () => {
        const webhook: Partial<Webhook> = {
            id: generateId(),
            url: "https://www.example.com/hooks",
            events: ["*"],
            active: true,
        };
        const create = await testUtils.testAuthedRequest<Webhook>(router, "/v2/webhooks", "POST", webhook);
        chai.assert.equal(create.statusCode, 201);
        chai.assert.deepInclude(create.body, webhook);

        const update: Partial<Webhook> = {
            ...webhook,
            events: ["updated:events"]
        };
        const patch = await testUtils.testAuthedRequest<Webhook>(router, `/v2/webhooks/${webhook.id}`, "PATCH", update);
        chai.assert.equal(patch.statusCode, 200);
        chai.assert.deepInclude(patch.body, update);

        const get = await testUtils.testAuthedRequest<Webhook>(router, `/v2/webhooks/${webhook.id}`, "GET");
        chai.assert.equal(get.statusCode, 200);
        chai.assert.deepInclude(get.body, update);
    });

    it("can list webhooks", async () => {
        const newUserRequest: <T>(router: cassava.Router, url: string, method: string, body?: any) =>
            Promise<ParsedProxyResponse<T>> = defaultTestUser.request.bind(new TestUser({userId: `${generateId()}-TEST`}));
        const webhooks: Webhook[] = [];


        for (let i = 0; i < 5; i++) {
            const partialWebhook: Partial<Webhook> = {
                id: generateId(),
                events: [`some:event:number${i}`],
                url: `https://userone.example.com/hooks/${i}`,
                active: true
            };
            const webhook = await newUserRequest<Webhook>(router, "/v2/webhooks", "POST", partialWebhook);
            chai.assert.equal(webhook.statusCode, 201);
            webhooks.push(webhook.body)
        }

        const list = await newUserRequest<Webhook[]>(router, `/v2/webhooks`, "GET");
        chai.assert.equal(list.statusCode, 200);
        chai.assert.equal(list.body.length, 5);
        chai.assert.sameDeepMembers<Webhook>(list.body, webhooks);
    });

    describe("data isolation among users", () => {
        const user1Request: <T>(router: cassava.Router, url: string, method: string, body?: any) =>
            Promise<ParsedProxyResponse<T>> = defaultTestUser.request.bind(new TestUser({userId: "user-one-TEST"}));
        const user2Request: <T>(router: cassava.Router, url: string, method: string, body?: any) =>
            Promise<ParsedProxyResponse<T>> = defaultTestUser.request.bind(new TestUser({userId: "user-two-TEST"}));

        it("two different users can create webhook with same id", async () => {
            const webhook: Partial<Webhook> = {
                id: generateId(),
                url: `https://example.com/hooks`,
                active: true,
                events: ["*"]
            };
            const req1: Partial<Webhook> = {...webhook, description: "user one's webhook"};
            const create1 = await user1Request<Webhook>(router, "/v2/webhooks", "POST", req1);
            chai.assert.equal(create1.statusCode, 201);

            const req2: Partial<Webhook> = {...webhook, description: "user two's webhook"};
            const create2 = await user2Request<Webhook>(router, "/v2/webhooks", "POST", req2);
            chai.assert.equal(create2.statusCode, 201);

            // get only returns own user's webhook

            const get1 = await user1Request<Webhook>(router, `/v2/webhooks/${webhook.id}`, "GET");
            chai.assert.equal(get1.statusCode, 200);
            chai.assert.deepInclude(get1.body, req1);

            // list only returns own user's webhook
            const list = await user1Request<Webhook[]>(router, `/v2/webhooks`, "GET");
            chai.assert.equal(list.statusCode, 200);
            chai.assert.equal(list.body.length, 1);
            chai.assert.sameDeepMembers<Webhook>(list.body, [get1.body]);
        });
    });
});