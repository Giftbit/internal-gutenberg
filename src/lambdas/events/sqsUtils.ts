import * as aws from "aws-sdk";
import {LightrailEvent} from "./LightrailEvent";
import {SQSRecord} from "aws-lambda";

export const QUEUE_URL = "https://sqs.us-west-2.amazonaws.com/757264843183/Microservices-TimJ-BatchTaskQueue";

export const sqs = new aws.SQS({
    // apiVersion: "2012-08-10",
    // endpoint: process.env["TEST_ENV"] === "true" ? "http://localhost:8000" : undefined,
    region: "us-west-2", // process.env["AWS_REGION"] //  AWS_REGION=us-west-2
});

export namespace SqsUtils {
    export async function sendMessage(event: LightrailEvent, delaySeconds: number = 0): Promise<any> {
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

    export async function getMessage(): Promise<any> {
        return await sqs.receiveMessage({QueueUrl: QUEUE_URL}).promise();
    }

    export async function backoff(record: SQSRecord): Promise<any> {
        const receivedCount = parseInt(record.attributes.ApproximateReceiveCount);
        const jitterMultiplier = 10 + getJitter();
        const visibilityTimeout = Math.min(Math.pow(receivedCount, 2) * (10 + jitterMultiplier) /* random scalar multiplier */, 43200);
        const params: aws.SQS.ChangeMessageVisibilityRequest = {
            ReceiptHandle: record.receiptHandle,
            QueueUrl: QUEUE_URL,
            VisibilityTimeout: visibilityTimeout
        };
        return await sqs.changeMessageVisibility(params)
    }
}

// returns a number between 0-10
export function getJitter(): number {
    return Math.random() * 10;
}
