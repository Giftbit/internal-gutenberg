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
    console.log("LOADED EVENT: " + JSON.stringify(event, null, 4));
    try {
        const result = await processLightrailEvent(event);
        if (result.failedWebhookIds.length === 0) {
            // finished
            await SqsUtils.deleteMessage(record);
        } else /* FAILED */ {
            if (sameElements(result.deliveredWebhookIds, event.deliveredWebhookIds)) {
                await handleRetryForSameFailingWebhookIds(record);
            } else {
                // need to requeue as same message since need to update the list of
                event.deliveredWebhookIds = result.deliveredWebhookIds;
                await SqsUtils.sendMessage(event, 30 /* the call to the webhook just failed so delay a little bit. 30 seconds is quite arbitrary.*/);
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

export async function processLightrailEvent(event: LightrailEvent): Promise<{ deliveredWebhookIds: string[], failedWebhookIds: string[] }> {
    if (!event.userId) {
        throw new DeleteMessageError(`Event ${JSON.stringify(event)} is missing a userid. It cannot be processed. Deleting message from queue.`);
    }
    if (!event.type) {
        throw new DeleteMessageError(`Event ${JSON.stringify(event)} is missing a type. It cannot be processed. Deleting message from queue.`);
    }

    const webhooks: Webhook[] = await Webhook.list(event.userId);
    log.info(`Retrieved ${JSON.stringify(webhooks)}`);

    const deliveredWebhookIds: string[] = event.deliveredWebhookIds ? event.deliveredWebhookIds : [];
    const webhooksToProcess = webhooks.filter(webhook => webhook.active && deliveredWebhookIds.indexOf(webhook.id) === -1);
    const failedWebhookIds: string[] = [];
    for (const webhook of webhooksToProcess) {
        if (Webhook.matchesEvent(webhook.events, event.type)) {

            log.info(`Webhook ${JSON.stringify(webhook)} matches event ${event.type}.`);
            const body = LightrailEvent.toPublicFacingEvent(event);
            const signatures = getSignatures(webhook.secrets.map(s => s.secret), body);
            const call = await sendDataToCallback(signatures, webhook.url, body);
            log.info(`Sent event to callback. Callback returned ${JSON.stringify(call)}`);

            if (call.statusCode >= 200 && call.statusCode < 300) {
                // todo metric success?
                log.info(`Successfully called webhook ${JSON.stringify(webhook)} for event: ${JSON.stringify(event)}.`);
                deliveredWebhookIds.push(webhook.id);
            } else {
                // will need to retry this webhook
                log.info(`Failed calling webhook ${JSON.stringify(webhook)} for event: ${JSON.stringify(event)}.`);
                failedWebhookIds.push(webhook.id);
            }
        }
    }

    return {deliveredWebhookIds: deliveredWebhookIds, failedWebhookIds: failedWebhookIds};
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
    { status: "FINISHED", deliveredWebhookIds: string[] }
    | { status: "FAILED", deliveredWebhookIds: string[] };

async function getActiveWebhooks(userId: string): Promise<Webhook[]> {
    return (await Webhook.list(userId)).filter(webhook => webhook.active);
}