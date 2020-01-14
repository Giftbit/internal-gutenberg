import * as aws from "aws-sdk";
import {clearQueue} from "../../utils/test/testUtils";
import {sqs, SqsUtils} from "./sqsUtils";
import {LightrailEvent} from "./LightrailEvent";
import {TestEvents} from "../../utils/test/testEvents";

describe("events processor test", () => {

    before(async function () {
        console.log("beginning test");
        aws.config.getCredentials(function (err) {
            if (err) console.log(err.stack);
            // credentials not loaded
            else {
                console.log("Access key:", aws.config.credentials.accessKeyId);
                console.log("Secret access key:", aws.config.credentials.secretAccessKey);
            }
        });

        const listQueues = await sqs.listQueues({}).promise();
        console.log(listQueues);
        await clearQueue();
    });

    it("test some queue calls", async () => {
        const event: LightrailEvent = TestEvents.getBasicTestEvent();

        const send = await SqsUtils.sendMessage(event);
        console.log("send: " + JSON.stringify(send, null, 4));

        const get = await SqsUtils.getMessage();
        console.log("get: " + JSON.stringify(get, null, 4));
    }).timeout(10000);
});