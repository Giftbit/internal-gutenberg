import * as awslambda from "aws-lambda";
import {SendMessageRequest} from "aws-sdk/clients/sqs";
import {DeleteMessageError} from "../errors/DeleteMessageError";

/**
 * Events that happen in the Lightrail system.
 * Event properties are mostly set by event producers.
 */
export interface LightrailEvent {
    /**
     * The version of the CloudEvents specification which the event uses.
     * By using this spec it might open the door to compatible tooling.
     */
    specVersion: string;

    /**
     * Event types are dot-separated.
     * eg: `lightrail.transaction.created`
     */
    type: string;

    /**
     * The service that generated the event formatted as a URI-reference.
     * eg: `/lightrail/rothschild`
     */
    source: string;

    /**
     * The ID of the event.  The combination of `source` + `id` must be unique.
     */
    id: string;

    /**
     * The ISO-8601 date of when the event was generated.
     */
    time: Date;

    /**
     * The Lightrail userId. Webhooks require a userId.
     */
    userId: string;

    /**
     * MIME type of the event data. Currently only application/json is supported.
     */
    dataContentType: "application/json";

    /**
     * The event body.
     */
    data: any;

    /**
     * If the event has to be re-queued after some successful and unsuccessful callbacks
     * this list will allow the webhook to know which webhooks it doesn't need to
     * call again.
     */
    deliveredWebhookIds?: string[];
}


export namespace LightrailEvent {
    export function toPublicFacingEvent(event: LightrailEvent): LightrailPublicFacingEvent {
        return {
            id: event.id,
            type: event.type,
            time: event.time instanceof Date ? new Date(event.time).toISOString() : event.time,
            data: event.data
        };
    }

    export function parseFromSQSRecord(record: awslambda.SQSRecord): LightrailEvent {
        if (record.messageAttributes["datacontenttype"]?.stringValue !== "application/json") {
            throw new Error(`SQS message property datacontenttype must be 'application/json'. Received ${record.messageAttributes["datacontenttype"]?.stringValue}.`)
        }
        if (!record.messageAttributes["userid"]?.stringValue) {
            throw new Error(`SQS message property userid must be set.`)
        }
        if (!record.messageAttributes["type"]?.stringValue) {
            throw new Error(`SQS message property type must be set.`)
        }

        try {
            return {
                specVersion: record.messageAttributes["specversion"]?.stringValue,
                type: record.messageAttributes["type"]?.stringValue,
                source: record.messageAttributes["source"]?.stringValue,
                id: record.messageAttributes["id"]?.stringValue,
                time: new Date(record.messageAttributes["time"]?.stringValue),
                userId: record.messageAttributes["userid"]?.stringValue,
                dataContentType: record.messageAttributes["datacontenttype"]?.stringValue,
                deliveredWebhookIds: record.messageAttributes["deliveredwebhookids"] ? JSON.parse(record.messageAttributes["deliveredwebhookids"].stringValue) : [],
                data: JSON.parse(record.body)
            };
        } catch (e) {
            throw new DeleteMessageError(`Error parsing record: ${JSON.stringify(record)}.`);
        }
    }

    export function toSQSSendMessageRequest(event: LightrailEvent, delaySeconds: number = 0): SendMessageRequest {
        return {
            MessageAttributes: {
                type: {DataType: "String", StringValue: event.type},
                source: {DataType: "String", StringValue: event.source},
                id: {DataType: "String", StringValue: event.id},
                time: {DataType: "String", StringValue: new Date(event.time).toISOString()},
                datacontenttype: {DataType: "String", StringValue: event.dataContentType},
                userid: {DataType: "String", StringValue: event.userId},
                deliveredwebhookids: {
                    DataType: "String",
                    StringValue: JSON.stringify((event.deliveredWebhookIds ? event.deliveredWebhookIds : []))
                }
            },
            MessageBody: JSON.stringify(event.data),
            QueueUrl: process.env["EVENT_QUEUE"],
            DelaySeconds: delaySeconds
        };
    }
}

export interface LightrailPublicFacingEvent {
    id: string;
    type: string;
    time: string;
    data: any;
}