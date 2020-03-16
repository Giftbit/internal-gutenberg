import * as aws from "aws-sdk";
import {SendMessageRequest} from "aws-sdk/clients/sqs";
import {SQSRecord} from "aws-lambda";
import SQS = require("aws-sdk/clients/sqs");
import log = require("loglevel");

const MAX_VISIBILITY_TIMEOUT = 43200;

export const sqs = new aws.SQS();

export namespace SqsUtils {
    export async function sendMessage(message: SendMessageRequest): Promise<SQS.Types.SendMessageResult> {
        return await sqs.sendMessage(message).promise();
    }

    export async function deleteMessage(record: SQSRecord): Promise<any> {
        return await sqs.deleteMessage({
            QueueUrl: process.env["EVENT_QUEUE"],
            ReceiptHandle: record.receiptHandle
        }).promise();
    }

    export async function backoffMessage(record: SQSRecord): Promise<{}> {
        const receivedCount = parseInt(record.attributes.ApproximateReceiveCount);
        const backoffTimeout = getBackoffTimeout(receivedCount);

        log.info(`SQS changeMessageVisibility ${record.messageId}. Received count: ${receivedCount}. Visibility timeout: ${backoffTimeout}.`);
        return await sqs.changeMessageVisibility({
            ReceiptHandle: record.receiptHandle,
            QueueUrl: process.env["EVENT_QUEUE"],
            VisibilityTimeout: backoffTimeout
        }).promise();
    }

    export async function receiveMessage(waitTimeSeconds: number = 0): Promise<SQS.Types.ReceiveMessageResult> {
        return await sqs.receiveMessage({
            QueueUrl: process.env["EVENT_QUEUE"],
            AttributeNames: ["All"],
            MessageAttributeNames: ["All"],
            WaitTimeSeconds: waitTimeSeconds,
            MaxNumberOfMessages: 10
        }).promise();
    }
}

/**
 * Based on: https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/
 * Implements full jitter which means it determines a maximum and randomly chooses a number between 0 and that maximum.
 * Maximums based on iteration: [30, 60, 120, 240, 480, 960, 1920, 3840, 7680, 15360, 30720, 43200]
 */
export function getBackoffTimeout(receivedCount: number): number {
    const backoff = Math.min(MAX_VISIBILITY_TIMEOUT, Math.pow(2, receivedCount) * 15);
    return Math.floor(Math.random() * backoff);
}
