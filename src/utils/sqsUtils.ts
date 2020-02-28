import * as aws from "aws-sdk";
import {SendMessageRequest} from "aws-sdk/clients/sqs";
import {SQSRecord} from "aws-lambda";
import SQS = require("aws-sdk/clients/sqs");
import log = require("loglevel");

const MAX_VISIBILITY_TIMEOUT = 43200;

export const sqs = new aws.SQS();

export namespace SqsUtils {
    export async function sendMessage(message: SendMessageRequest): Promise<SQS.Types.SendMessageResult> {
        log.info(`SQS sendMessage.`, JSON.stringify(message));
        return await sqs.sendMessage(message).promise();
    }

    export async function deleteMessage(record: SQSRecord): Promise<any> {
        log.info(`SQS delete message ${record.messageId}.`);
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
 * Returns a number between 0 - min(2 ^ receivedCount * 5, 43200)
 * Based on: https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/
 *
 * Produces values for (increasing receivedCounts):
 * 10, 20, 40, 80, 160, 320, 640, 1280, 2560, 5120, 10240, 20480, 40960, 43200
 */
export function getBackoffTimeout(receivedCount: number): number {
    const backoff = Math.min(MAX_VISIBILITY_TIMEOUT, Math.pow(2, receivedCount) * 5 /* base backoff multiplier 5s - quite haphazard in choice */);
    return Math.floor(Math.random() * backoff); // Full jitter. Between 0 and the new calculated backoff.
}
