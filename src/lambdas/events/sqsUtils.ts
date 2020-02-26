import * as aws from "aws-sdk";
import {Message, SendMessageRequest} from "aws-sdk/clients/sqs";
import SQS = require("aws-sdk/clients/sqs");
import log = require("loglevel");

const MAX_VISIBILITY_TIMEOUT = 43200;

export const sqs = new aws.SQS({
    region: "us-west-2"
});

export namespace SqsUtils {
    export async function sendMessage(message: SendMessageRequest): Promise<SQS.Types.SendMessageResult> {
        log.info(`SQS sendMessage ${message.MessageAttributes["id"]}.`);
        return await sqs.sendMessage(message).promise();
    }

    export async function deleteMessage(message: Message): Promise<any> {
        log.info(`SQS delete message ${message.MessageId}.`);
        return await sqs.deleteMessage({
            QueueUrl: process.env["EVENT_QUEUE"],
            ReceiptHandle: message.ReceiptHandle
        });
    }

    export async function backoff(message: Message): Promise<{}> {
        const receivedCount = parseInt(message.Attributes.ApproximateReceiveCount);

        const params: aws.SQS.ChangeMessageVisibilityRequest = {
            ReceiptHandle: message.ReceiptHandle,
            QueueUrl: process.env["EVENT_QUEUE"],
            VisibilityTimeout: getBackoffTimeout(receivedCount)
        };

        log.info(`SQS changeMessageVisibility ${message.MessageId}. Received count: ${receivedCount}. Visibility timeout: ${params.VisibilityTimeout}.`);
        return await sqs.changeMessageVisibility(params);
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
 */
export function getBackoffTimeout(receivedCount: number): number {
    const backoff = Math.min(MAX_VISIBILITY_TIMEOUT, Math.pow(2, receivedCount) * 5 /* base backoff multiplier 5s - quite haphazard in choice */);
    return Math.floor(Math.random() * backoff); // Full jitter. Between 0 and the new calculated backoff.
}
