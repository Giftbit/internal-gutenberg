import * as testUtils from "../../../utils/testUtils/index";
import {generateId, resetDb} from "../../../utils/testUtils";
import * as chai from "chai";
import * as cassava from "cassava";
import {Webhook} from "../../../db/Webhook";
import {installAuthedRestRoutes} from "../installAuthedRestRoutes";

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

        const get = await testUtils.testAuthedRequest<Webhook>(router, `/v2/webhooks/${webhook.id}`, "GET");
        chai.assert.equal(get.statusCode, 200);
        chai.assert.deepInclude(get.body, webhook);
    });
});