import * as awslambda from "aws-lambda";
import {LightrailEvent} from "./LightrailEvent";
import * as chai from "chai";
import {defaultTestUser, generateId} from "../../../utils/test/testUtils";

describe("LightrailEvent", () => {

    it("LightrailEvent.parseFromSQSRecord", () => {
        const date = new Date("2020");
        const sqsRecord: awslambda.SQSRecord = {
            messageId: "id",
            receiptHandle: "handle",
            body: JSON.stringify({
                plane: "boeing"
            }),
            attributes: null,
            messageAttributes: {
                specversion: {
                    dataType: "String",
                    stringValue: "1.0",
                    stringListValues: null, // this property is required by SQSRecord but isn't used
                    binaryListValues: null, // same
                },
                type: {
                    dataType: "String",
                    stringValue: "plane.created",
                    stringListValues: null, // this property is required by SQSRecord but isn't used
                    binaryListValues: null, // same
                },
                source: {
                    dataType: "String",
                    stringValue: "/gutenberg/tests",
                    stringListValues: null,
                    binaryListValues: null,
                },
                id: {
                    dataType: "String",
                    stringValue: "123",
                    stringListValues: null,
                    binaryListValues: null,
                },
                time: {
                    dataType: "String",
                    stringValue: date.toISOString(),
                    stringListValues: null,
                    binaryListValues: null,
                },
                datacontenttype: {
                    dataType: "String",
                    stringValue: "application/json",
                    stringListValues: null,
                    binaryListValues: null,
                },
                userid: {dataType: "String", stringValue: "user-123", stringListValues: null, binaryListValues: null,}
            },
            md5OfBody: null,
            eventSource: null,
            eventSourceARN: null,
            awsRegion: null
        };

        const lrEvent: LightrailEvent = LightrailEvent.parseFromSQSRecord(sqsRecord);
        chai.assert.deepEqual(lrEvent, {
            "specVersion": "1.0",
            "type": "plane.created",
            "source": "/gutenberg/tests",
            "id": "123",
            "time": "2020-01-01T00:00:00.000Z",
            "userId": "user-123",
            "dataContentType": "application/json",
            "deliveredWebhookIds": [],
            "data": {"plane": "boeing"}
        });

        const sqsRecordWithDeliveredWebhookIds = {
            ...sqsRecord,
            messageAttributes: {
                ...sqsRecord.messageAttributes,
                deliveredwebhookids: {
                    dataType: "String",
                    stringValue: JSON.stringify(["webhook1", "webhook2"]),
                    stringListValues: null,
                    binaryListValues: null,
                },
            }
        };
        const lrEvent2: LightrailEvent = LightrailEvent.parseFromSQSRecord(sqsRecordWithDeliveredWebhookIds);
        chai.assert.deepEqual(lrEvent2, {
            "specVersion": "1.0",
            "type": "plane.created",
            "source": "/gutenberg/tests",
            "id": "123",
            "time": "2020-01-01T00:00:00.000Z",
            "userId": "user-123",
            "dataContentType": "application/json",
            "deliveredWebhookIds": ["webhook1", "webhook2"],
            "data": {"plane": "boeing"}
        });
    });

    it("parsing a partial event", () => {
        const sqsRecord: awslambda.SQSRecord = {
            messageId: "id",
            receiptHandle: "handle",
            body: JSON.stringify({
                plane: "boeing"
            }),
            attributes: null,
            messageAttributes: {},
            md5OfBody: null,
            eventSource: null,
            eventSourceARN: null,
            awsRegion: null
        };

        const lrEvent: LightrailEvent = LightrailEvent.parseFromSQSRecord(sqsRecord);
        console.log(JSON.stringify(lrEvent, null, 4));
    });

    it("toSQSSendMessageEvent", () => {
        const lightrailEvent: LightrailEvent = {
            specVersion: "1.0",
            type: "plane.created",
            source: "/gutenberg/tests",
            id: generateId(),
            time: new Date(),
            userId: defaultTestUser.auth.userId,
            dataContentType: "application/json",
            data: {
                simpleProp: "1",
                nested: {
                    here: "okay"
                },
                createdDate: new Date().toISOString()
            }
        };

    })
});