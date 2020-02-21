import * as testUtils from "../../utils/test/testUtils";
import {defaultTestUser, generateId, resetDb} from "../../utils/test/testUtils";
import * as chai from "chai";
import * as cassava from "cassava";
import {getSecretLastFour, Webhook, WebhookSecret} from "../../db/Webhook";
import {installAuthedRestRoutes} from "./installAuthedRestRoutes";
import {ParsedProxyResponse} from "../../utils/test/ParsedProxyResponse";
import {TestUser} from "../../utils/test/TestUser";
import {initializeSecretEncryptionKey} from "./webhookSecretUtils";
import chaiExclude from "chai-exclude";
import {webhookCreateSchema, webhookUpdateSchema} from "./webhooks";

chai.use(chaiExclude);

describe("webhooks", function () {
    const router = new cassava.Router();

    before(async function () {
        router.route(testUtils.authRoute);
        initializeSecretEncryptionKey(Promise.resolve({SecretString: "secret"}));
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
    });

    it("can create a webhook with list of events and active = false", async () => {
        const webhook: Partial<Webhook> = {
            id: generateId(),
            url: "https://www.example.com/hooks",
            events: ["lightrail.value.created", "lightrail.value.deleted"],
            active: false,
        };
        const create = await testUtils.testAuthedRequest<Webhook>(router, "/v2/webhooks", "POST", webhook);
        chai.assert.equal(create.statusCode, 201);
        chai.assert.deepInclude(create.body, webhook);
        chai.assert.isNotEmpty(create.body.secrets);

        const get = await testUtils.testAuthedRequest<Webhook>(router, `/v2/webhooks/${webhook.id}`, "GET");
        chai.assert.equal(get.statusCode, 200);
        chai.assert.deepInclude(get.body, webhook);
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

    it("can get a webhook", async () => {
        const webhook: Partial<Webhook> = {
            id: generateId(),
            url: "https://www.example.com/hooks",
            events: ["*"],
            active: true,
        };
        const create = await testUtils.testAuthedRequest<Webhook>(router, "/v2/webhooks", "POST", webhook);
        chai.assert.equal(create.statusCode, 201);

        const get = await testUtils.testAuthedRequest<Webhook>(router, `/v2/webhooks/${webhook.id}`, "GET");
        chai.assert.equal(get.statusCode, 200);
        chai.assert.deepInclude(get.body, webhook);
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
            events: ["updated:events"]
        };
        const patch = await testUtils.testAuthedRequest<Webhook>(router, `/v2/webhooks/${webhook.id}`, "PATCH", update);
        chai.assert.equal(patch.statusCode, 200);
        chai.assert.deepInclude(patch.body, update);

        const get = await testUtils.testAuthedRequest<Webhook>(router, `/v2/webhooks/${webhook.id}`, "GET");
        chai.assert.equal(get.statusCode, 200);
        chai.assert.deepInclude(get.body, patch.body);
    });

    describe("secret tests (interdependent)", () => {
        const webhook: Partial<Webhook> = {
            id: generateId(),
            url: "https://www.example.com/hooks",
            events: ["*"],
            active: true,
        };
        let initialSecret: WebhookSecret;

        before(async () => {
            const create = await testUtils.testAuthedRequest<Webhook>(router, "/v2/webhooks", "POST", webhook);
            chai.assert.equal(create.statusCode, 201);
            initialSecret = create.body.secrets[0];
            chai.assert.lengthOf(initialSecret.secret, 16, "expect full secret to be returned");
        });

        it("can get a secret", async () => {
            const get = await testUtils.testAuthedRequest<WebhookSecret>(router, `/v2/webhooks/${webhook.id}/secrets/${initialSecret.id}`, "GET");
            chai.assert.equal(get.statusCode, 200);
            chai.assert.deepEqual(get.body, initialSecret);
        });

        it("can't delete a webhook's only secret", async () => {
            const del = await testUtils.testAuthedRequest<{}>(router, `/v2/webhooks/${webhook.id}/secrets/${initialSecret.id}`, "DELETE");
            chai.assert.equal(del.statusCode, 409);
        });

        let secondSecret: WebhookSecret;
        it("can create a new secret", async () => {
            const create = await testUtils.testAuthedRequest<WebhookSecret>(router, `/v2/webhooks/${webhook.id}/secrets`, "POST", {});
            chai.assert.equal(create.statusCode, 201);
            secondSecret = create.body;
            chai.assert.lengthOf(secondSecret.secret, 16, "expect full secret to be returned");
            chai.assert.notDeepEqual(initialSecret, secondSecret);
        });

        it("can list secrets via webhook GET", async () => {
            chai.assert.isNotNull(secondSecret, "this test depends on the one above and it must have failed");
            const list = await testUtils.testAuthedRequest<Webhook>(router, `/v2/webhooks/${webhook.id}`, "GET");
            chai.assert.equal(list.statusCode, 200);
            chai.assert.sameDeepMembers(list.body.secrets, [{
                ...initialSecret,
                secret: getSecretLastFour(initialSecret.secret)
            }, {
                ...secondSecret,
                secret: getSecretLastFour(secondSecret.secret)
            }
            ]);
        });

        it("cant list secrets via .../v2/webhooks/<id>/secrets - 404", async () => {
            const list = await testUtils.testAuthedRequest<Webhook>(router, `/v2/webhooks/${webhook.id}/secrets`, "GET");
            chai.assert.equal(list.statusCode, 404);
        });

        let thirdSecret: WebhookSecret;
        it("can add a third secret", async () => {
            const create = await testUtils.testAuthedRequest<WebhookSecret>(router, `/v2/webhooks/${webhook.id}/secrets`, "POST", {});
            chai.assert.equal(create.statusCode, 201);
            thirdSecret = create.body;
        });

        it("can't add a fourth secret - 3 is the max", async () => {
            chai.assert.isNotNull(thirdSecret, "this test depends on the one above and it must have failed");
            const create = await testUtils.testAuthedRequest<WebhookSecret>(router, `/v2/webhooks/${webhook.id}/secrets`, "POST", {});
            chai.assert.equal(create.statusCode, 409);
        });

        it("can delete a secret", async () => {
            const del = await testUtils.testAuthedRequest<{}>(router, `/v2/webhooks/${webhook.id}/secrets/${secondSecret.id}`, "DELETE");
            chai.assert.equal(del.statusCode, 200);

            const list = await testUtils.testAuthedRequest<Webhook>(router, `/v2/webhooks/${webhook.id}`, "GET");
            chai.assert.equal(list.statusCode, 200);
            chai.assert.sameDeepMembers(list.body.secrets, [{
                ...initialSecret,
                secret: getSecretLastFour(initialSecret.secret)
            }, {
                ...thirdSecret,
                secret: getSecretLastFour(thirdSecret.secret)
            }
            ]);
        });
    });

    it("can list webhooks", async () => {
        const newUserRequest: <T>(router: cassava.Router, url: string, method: string, body?: any) =>
            Promise<ParsedProxyResponse<T>> = defaultTestUser.request.bind(new TestUser({userId: `${generateId()}-TEST`}));
        const webhooks: Webhook[] = [];


        for (let i = 0; i < 5; i++) {
            const partialWebhook: Partial<Webhook> = {
                id: "abc" + i,
                events: [`some:event:number${i}`],
                url: `https://userone.example.com/hooks/${i}`,
                active: true
            };
            const webhook = await newUserRequest<Webhook>(router, "/v2/webhooks", "POST", partialWebhook);
            chai.assert.equal(webhook.statusCode, 201);
            webhooks.push(webhook.body);
        }

        const list = await newUserRequest<Webhook[]>(router, `/v2/webhooks`, "GET");
        chai.assert.equal(list.statusCode, 200);
        chai.assert.equal(list.body.length, 5);

        chai.assert.sameDeepMembers<Webhook>(list.body, webhooks.map(webhook => ({
            ...webhook,
            secrets: webhook.secrets.map(secret => ({...secret, secret: getSecretLastFour(secret.secret)}))
        })));
    });

    it("assert webhookCreateSchema", async () => {
        chai.assert.deepEqual(webhookCreateSchema, {
            type: "object",
            additionalProperties: false,
            properties: {
                id: {
                    type: "string",
                    maxLength: 64,
                    minLength: 1,
                    pattern: "^[ -~]*$"
                },
                url: {
                    type: "uri"
                },
                events: {
                    type: ["array"],
                    items: {
                        type: "string",
                        minLength: 1,
                        maxLength: 100
                    }
                },
                active: {
                    type: "boolean"
                }
            },
            required: ["id", "url", "events"]
        })
    });

    it("assert webhookUpdateSchema", async () => {
        chai.assert.deepEqual(webhookUpdateSchema, {
            type: "object",
            additionalProperties: false,
            properties: {
                url: {
                    type: "uri"
                },
                events: {
                    type: ["array"],
                    items: {
                        type: "string",
                        minLength: 1,
                        maxLength: 100
                    }
                },
                active: {
                    type: "boolean"
                }
            },
            required: []
        })
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
            const req1: Partial<Webhook> = {...webhook};
            const create1 = await user1Request<Webhook>(router, "/v2/webhooks", "POST", req1);
            chai.assert.equal(create1.statusCode, 201);

            const req2: Partial<Webhook> = {...webhook};
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