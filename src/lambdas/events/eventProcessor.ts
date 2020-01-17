import * as awslambda from "aws-lambda";
import {LightrailEvent, sqsRecordToLightrailEvent} from "./LightrailEvent";
import {DeleteMessageError} from "./errors/DeleteMessageError";
import {SqsUtils} from "./sqsUtils";
import {Webhook} from "../../db/Webhook";
import {getSignatures} from "./signatureUtils";
import {sendDataToCallback} from "./callbackUtils";
import log = require("loglevel");

export async function processSQSRecord(record: awslambda.SQSRecord): Promise<void> {
    let lightrailEvent: LightrailEvent = sqsRecordToLightrailEvent(record);
    try {
        lightrailEvent = await processLightrailEvent(lightrailEvent);
        if (lightrailEvent.failedWebhookIds.length > 0) {

        } else {
            await SqsUtils.deleteMessage(record);
        }
    } catch (e) {
        if (e instanceof DeleteMessageError) {
            await SqsUtils.deleteMessage(record);
        } else {
            // an unexpected error occurred.
            // todo - exponentially backoff message visibility
            // todo - what about the case when we need to update which webhooks were successful?
        }
    }

    // success = delete message
    // unknown error = exponentially backoff


}

export async function processLightrailEvent(event: LightrailEvent): Promise<LightrailEvent> {
    if (!event.userid) {
        throw new DeleteMessageError(`Event ${JSON.stringify(event)} is missing a userid. It cannot be processed. Deleting message from queue.`);
    }

    const webhooks: Webhook[] = await Webhook.list(event.userid);
    log.info(`Retrieved ${JSON.stringify(webhooks)}`);

    const failedWebhookIds: string[] = [];
    const isRetry = event.failedWebhookIds.length > 0;
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

    if (failedWebhookIds) {
        event.failedWebhookIds = failedWebhookIds;
    }

    return event;
}