import * as awslambda from "aws-lambda";
import {LightrailEvent, sqsRecordToLightrailEvent} from "./LightrailEvent";
import {DeleteMessageError} from "./errors/DeleteMessageError";
import {SqsUtils} from "./sqsUtils";
import {Webhook} from "../../db/Webhook";
import {getSignatures} from "./signatureUtils";
import {sendDataToCallback} from "./callbackUtils";
import {sameElements} from "../../utils/arrayUtils";
import log = require("loglevel");

export async function processSQSRecord(record: awslambda.SQSRecord): Promise<void> {
    const event: LightrailEvent = sqsRecordToLightrailEvent(record);
    try {
        const messageAction: ProcessesEventResult = await processLightrailEvent(event);
        if (messageAction.status === "FINISHED") {
            await SqsUtils.deleteMessage(record);
        } else /* FAILED */ {
            if (sameElements(messageAction.failedWebhookIds, event.failedWebhookIds)) {
                await handleRetryForSameFailingWebhookIds(record);
            } else {
                // This occurs when there are new failing webhook ids. This can occur on the first run
                // because there are no failing webhook ids to begin with. Webhooks that have already
                // been successfully called should not be called again. To prevent this a list of failed
                // webhook ids must be stored on the SQS message. SQS messages cannot be updated. As such
                // it must be queued as a new message.
                event.failedWebhookIds = messageAction.failedWebhookIds;
                await SqsUtils.sendMessage(event, 30 /* the call to the webhook just failed. this 30sec delay is quite haphazard.*/);
                await SqsUtils.deleteMessage(record);
            }
        }
    } catch (e) {
        if (e instanceof DeleteMessageError) {
            await SqsUtils.deleteMessage(record);
        } else {
            // An unexpected error occurred. Will backoff to a maximum of 12 hours.
            // Won't delete the message off the queue after 3 days because this represents
            // an unexpected failure on our side. The message will be retried for up to 14 days
            // which is the maximum length a message can be in an sqs queue.
            await SqsUtils.backoff(record);
        }
    }
}

export async function processLightrailEvent(event: LightrailEvent): Promise<ProcessesEventResult> {
    if (!event.userid) {
        throw new DeleteMessageError(`Event ${JSON.stringify(event)} is missing a userid. It cannot be processed. Deleting message from queue.`);
    }

    const webhooks: Webhook[] = await getActiveWebhooks(event.userid);
    log.info(`Retrieved ${JSON.stringify(webhooks)}`);

    const failedWebhookIds: string[] = [];
    const isRetry = event.failedWebhookIds && event.failedWebhookIds.length > 0;
    for (const webhook of webhooks) {
        if (Webhook.matchesEvent(webhook.events, event.type) && (!isRetry || (isRetry && event.failedWebhookIds.includes(webhook.id)))) {
            log.info(`Webhook ${JSON.stringify(webhook)} matches event ${event.type}.`);
            const body = LightrailEvent.toPublicFacingEvent(event);
            const signatures = getSignatures(webhook.secrets, body);
            const call = await sendDataToCallback(signatures, webhook.url, body);
            log.info(`Sent event to callback. Callback returned ${JSON.stringify(call)}`);
            if (call.statusCode >= 200 && call.statusCode < 300) {
                // success.
                // do nothing!
            } else {
                // will need to retry this webhook
                failedWebhookIds.push(webhook.id);
            }
        }
    }

    if (failedWebhookIds.length === 0) {
        return {status: "FINISHED"};
    } else {
        return {status: "FAILED", failedWebhookIds: failedWebhookIds}
    }
}

async function handleRetryForSameFailingWebhookIds(record: awslambda.SQSRecord): Promise<any> {
    if (new Date().getTime() - parseInt(record.attributes.SentTimestamp) > 259200000 /* 3 days in ms = 3d * 24h * 60m * 60s * 1000ms */) {
        // exceeds 3 days. delete
        return await SqsUtils.deleteMessage(record);
    } else {
        return await SqsUtils.backoff(record);
    }
}

export type ProcessesEventResult =
    { status: "FINISHED" }
    | { status: "FAILED", failedWebhookIds: string[] };

async function getActiveWebhooks(userId: string): Promise<Webhook[]> {
    return (await Webhook.list(userId)).filter(webhook => webhook.active);
}