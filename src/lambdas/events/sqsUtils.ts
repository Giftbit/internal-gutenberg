import * as aws from "aws-sdk";
import {LightrailEvent} from "./LightrailEvent";
import {SQSRecord} from "aws-lambda";
import SQS = require("aws-sdk/clients/sqs");

export const QUEUE_URL = "https://sqs.us-west-2.amazonaws.com/757264843183/Microservices-TimJ-BatchTaskQueue";
const MAX_VISILIBILTY_TIMEOUT = 43200;

export const sqs = new aws.SQS({
    // apiVersion: "2012-08-10",
    // endpoint: process.env["TEST_ENV"] === "true" ? "http://localhost:8000" : undefined,
    region: "us-west-2", // process.env["AWS_REGION"] //  AWS_REGION=us-west-2
});

export namespace SqsUtils {
    export async function sendMessage(event: LightrailEvent, delaySeconds: number = 0): Promise<SQS.Types.SendMessageResult> {
        const params: aws.SQS.SendMessageRequest = {
            ...LightrailEvent.toSQSEvent(event),
            QueueUrl: QUEUE_URL,
            DelaySeconds: delaySeconds
        };

        return await sqs.sendMessage(params).promise();
    }

    export async function deleteMessage(record: SQSRecord): Promise<any> {
        return await sqs.deleteMessage({
            QueueUrl: QUEUE_URL,
            ReceiptHandle: record.receiptHandle
        });
    }

    export async function backoff(record: SQSRecord): Promise<{}> {
        const receivedCount = parseInt(record.attributes.ApproximateReceiveCount);

        const params: aws.SQS.ChangeMessageVisibilityRequest = {
            ReceiptHandle: record.receiptHandle,
            QueueUrl: QUEUE_URL,
            VisibilityTimeout: getBackoffTimeout(receivedCount)
        };
        return await sqs.changeMessageVisibility(params)
    }
}

/**
 * Returns a number between 0 - min(2 ^ receivedCount * 5, 43200)
 * Based on: https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/
 */
export function getBackoffTimeout(receivedCount: number): number {
    const backoff = Math.min(MAX_VISILIBILTY_TIMEOUT, Math.pow(2, receivedCount) * 5 /* base backoff multiplier 5s - quite haphazard in choice */);
    return Math.floor(Math.random() * backoff); // Full jitter. Between 0 and the new calculated backoff.
}
