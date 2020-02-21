import {getBackoffTimeout, SqsUtils} from "./sqsUtils";
import * as chai from "chai";
import {LightrailEvent} from "./LightrailEvent";
import {generateId, purgeQueue, receiveMessage} from "../../utils/test/testUtils";

describe("sqsUtils", function () {
    this.timeout(15000);

    it("getExponential Backoff", () => {
        for (let receivedCount = 1; receivedCount < 10; receivedCount++) {
            let max = Math.pow(2, receivedCount) * 5;
            for (let j = 0; j < 100; j++) {
                const backoff = getBackoffTimeout(receivedCount);
                chai.assert.isAtMost(backoff, max);
            }
        }
    });

    describe("re-queues events correctly", () => {
        before(async () => {
            await purgeQueue();
        });

        const event: LightrailEvent = {
            specVersion: "1.0",
            type: "airplane.created",
            source: "/gutenberg/tests",
            id: generateId(),
            time: new Date("2020-01-01"),
            userId: "user-12345",
            dataContentType: "application/json",
            data: {
                simpleProp: "1",
                nested: {
                    here: "okay"
                },
                createdDate: new Date().toISOString()
            }
        };

        it("can queue LightrailEvent", async () => {
            const req = LightrailEvent.toSQSSendMessageRequest(event, 0);
            console.log(JSON.stringify(req, null, 4));
            const send = await SqsUtils.sendMessage(req);
            console.log(JSON.stringify(send));
        });

        it("can receive message and parse into LightrailEvent", async () => {
            const message = await receiveMessage();
            console.log(JSON.stringify(message, null, 4));
            // const parsedMessage: LightrailEvent = sqsRecordToLightrailEvent(message.Messages[0]);
        })
    });
});