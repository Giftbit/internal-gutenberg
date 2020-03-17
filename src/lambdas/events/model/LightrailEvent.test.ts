import * as awslambda from "aws-lambda";
import {LightrailEvent} from "./LightrailEvent";
import * as chai from "chai";
import {defaultTestUser} from "../../../utils/test/testUtils";

describe("LightrailEvent", () => {

    it("can parse from SQSRecord to LightrailEvent", () => {
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
                    stringListValues: null,
                    binaryListValues: null,
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
                userid: {
                    dataType: "String",
                    stringValue: "user-123",
                    stringListValues: null,
                    binaryListValues: null,
                }
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
            "time": new Date("2020-01-01T00:00:00.000Z"),
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
            "time": new Date("2020-01-01T00:00:00.000Z"),
            "userId": "user-123",
            "dataContentType": "application/json",
            "deliveredWebhookIds": ["webhook1", "webhook2"],
            "data": {"plane": "boeing"}
        });
    });

    it("can parse a partial event", () => {
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
        chai.assert.isNotNull(lrEvent);
    });

    it("can convert LightrailEvent to PublicFacingEvent", () => {
        const lightrailEvent: LightrailEvent = {
            specVersion: "1.0",
            type: "plane.created",
            source: "/gutenberg/tests",
            id: "123",
            time: new Date(0),
            userId: defaultTestUser.auth.userId,
            dataContentType: "application/json",
            data: {
                simpleProp: "1",
                nested: {
                    here: "okay"
                },
                createdDate: new Date(0).toISOString()
            }
        };
        const result = LightrailEvent.toPublicFacingEvent(lightrailEvent);
        chai.assert.deepEqual(result, {
            "id": "123",
            "type": "plane.created",
            "time": "1970-01-01T00:00:00.000Z",
            "data": {
                "simpleProp": "1",
                "nested": {
                    "here": "okay"
                },
                "createdDate": "1970-01-01T00:00:00.000Z"
            }
        });
    });

    it("can convert LightrailEvent to SQSSendMessageEvent", () => {
        const lightrailEvent: LightrailEvent = {
            specVersion: "1.0",
            type: "plane.created",
            source: "/gutenberg/tests",
            id: "123",
            time: new Date(0),
            userId: defaultTestUser.auth.userId,
            dataContentType: "application/json",
            data: {
                simpleProp: "1",
                nested: {
                    here: "okay"
                },
                createdDate: new Date(0).toISOString()
            }
        };
        const sendMessage = LightrailEvent.toSQSSendMessageRequest(lightrailEvent);
        chai.assert.deepEqual(sendMessage, {
            MessageAttributes: {
                type: {
                    DataType: "String",
                    StringValue: "plane.created"
                },
                source: {
                    DataType: "String",
                    StringValue: "/gutenberg/tests"
                },
                id: {
                    DataType: "String",
                    StringValue: "123"
                },
                time: {
                    DataType: "String",
                    StringValue: "1970-01-01T00:00:00.000Z"
                },
                datacontenttype: {
                    DataType: "String",
                    StringValue: "application/json"
                },
                userid: {
                    DataType: "String",
                    StringValue: "default-test-user-TEST"
                },
                deliveredwebhookids: {
                    DataType: "String",
                    StringValue: "[]"
                }
            },
            QueueUrl: "doesntmatterfortesting",
            MessageBody: "{\"simpleProp\":\"1\",\"nested\":{\"here\":\"okay\"},\"createdDate\":\"1970-01-01T00:00:00.000Z\"}",
            DelaySeconds: 0
        });
    });
});