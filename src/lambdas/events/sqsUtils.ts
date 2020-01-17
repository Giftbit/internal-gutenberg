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
    export async function sendMessage(event: LightrailEvent): Promise<any> {
        const params: aws.SQS.SendMessageRequest = {
            ...LightrailEvent.toSQSEvent(event),
            DelaySeconds: 0,
            QueueUrl: QUEUE_URL
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

    export async function sendMessageWithExponentialBackoff(event: LightrailEvent, previousVisibilityTimeout: number): Promise<any> {
        previousVisibilityTimeout
    }
}

