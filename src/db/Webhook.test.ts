import {CreateWebhookParams, DbWebhook, Webhook} from "./Webhook";
import * as chai from "chai";
import {generateId, resetDb} from "../utils/test/testUtils";
import {decryptSecret, initializeSecretEncryptionKey} from "../lambdas/rest/webhookSecretUtils";
import chaiExclude from "chai-exclude";

chai.use(chaiExclude);

describe("Webhook", () => {

    before(async function () {
        initializeSecretEncryptionKey(Promise.resolve({SecretString: "secret"}));
        await resetDb();
    });

    describe("matching events", () => {
        interface MatchTest {
            eventSubscriptions: string[];
            event: string;
            matches: boolean;
        }

        const matchTests: MatchTest[] = [
            {eventSubscriptions: ["*"], event: "a", matches: true},
            {eventSubscriptions: ["a"], event: "a", matches: true},
            {eventSubscriptions: ["a"], event: "b", matches: false},
            {eventSubscriptions: ["a"], event: "a.b", matches: false},
            {eventSubscriptions: ["a.*"], event: "a", matches: true},
            {eventSubscriptions: ["a.*"], event: "b", matches: false},
            {eventSubscriptions: ["a.*"], event: "a.b", matches: true},
            {eventSubscriptions: ["a.b"], event: "a", matches: false},
            {eventSubscriptions: ["a.b"], event: "a", matches: false},
            {eventSubscriptions: ["a.b"], event: "b", matches: false},
            {eventSubscriptions: ["a.b"], event: "a.b", matches: true},
            {eventSubscriptions: ["a.b"], event: "b.a", matches: false},
            {eventSubscriptions: ["a.b"], event: "a.b.c", matches: false},
            {eventSubscriptions: ["a.b.*"], event: "a.b", matches: true},
            {eventSubscriptions: ["a", "b"], event: "a", matches: true},
            {eventSubscriptions: ["a", "b"], event: "b", matches: true},
            {eventSubscriptions: ["a", "b"], event: "c", matches: false}
        ];

        for (const test of matchTests) {
            it(`event subscriptions ${test.eventSubscriptions} ${test.matches ? "matches" : "does not match"} event ${test.event}`, () => {
                chai.assert.equal(Webhook.matchesEvent(test.eventSubscriptions, test.event), test.matches);
            });
        }
    });

    it("can convert from DbWebhook to Webhook and back to DbWebhook", async () => {
        const createParams: CreateWebhookParams = {
            id: generateId(),
            url: "https://www.example.com/hooks",
            events: ["*"],
            active: true,
        };
        const webhook1 = await Webhook.create("user-123", "teamMember-123", createParams);
        const dbWebhook1 = await DbWebhook.toDbObject("user-123", webhook1);

        const webhook2 = await DbWebhook.fromDbObject(dbWebhook1, true);
        chai.assert.deepEqual(webhook1, webhook2);

        const dbWebhook2 = await DbWebhook.toDbObject("user-123", webhook2);
        chai.assert.deepEqualExcluding(dbWebhook1, dbWebhook2, "encryptedSecrets");
        chai.assert.deepEqual({
            ...dbWebhook1.encryptedSecrets[0],
            encryptedSecret: await decryptSecret(dbWebhook1.encryptedSecrets[0].encryptedSecret)
        }, {
            ...dbWebhook1.encryptedSecrets[0],
            encryptedSecret: await decryptSecret(dbWebhook2.encryptedSecrets[0].encryptedSecret)
        });
    });
});