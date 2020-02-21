import * as awslambda from "aws-lambda";
import {LightrailEvent} from "./LightrailEvent";
import {DeleteMessageError} from "./errors/DeleteMessageError";
import {SqsUtils} from "./sqsUtils";
import {getSecretLastFour, Webhook} from "../../db/Webhook";
import {getSignatures} from "./signatureUtils";
import {sendDataToCallback} from "./callbackUtils";
import {sameElements} from "../../utils/arrayUtils";
import {MetricsLogger} from "../../utils/metricsLogger";
import log = require("loglevel");

export async function processSQSRecord(record: awslambda.SQSRecord): Promise<void> {
    const event: LightrailEvent = LightrailEvent.parseFromSQSRecord(record);
    log.info(`Received event: ${JSON.stringify(event, null, 4)}.`);
    try {
        const result = await processLightrailEvent(event);
        log.info(`Finished processing event ${event.id}. Result: ${JSON.stringify(result)}.`);
        if (result.failedWebhookIds.length > 0) {
            if (sameElements(result.deliveredWebhookIds, event.deliveredWebhookIds)) {
                log.info("Same delivered webhookIds so handling retry for failures.");
                await handleRetryForSameFailingWebhookIds(record);
            } else {
                log.info("Need to requeue as same message since need to update the list of deliveredWebhookIds.");
                event.deliveredWebhookIds = result.deliveredWebhookIds;
                await SqsUtils.sendMessage(LightrailEvent.toSQSSendMessageRequest(event, 30 /* the call to the webhook just failed so delay a little bit. 30 seconds is quite arbitrary.*/));
                await SqsUtils.deleteMessage(record);
            }
        } else {
            log.info(`No failing webhookIds so deleting event ${event.id}.`);
            await SqsUtils.deleteMessage(record);
        }
    } catch (e) {
        if (e instanceof DeleteMessageError) {
            log.error(`DeleteMessageError thrown. Error: ${JSON.stringify(e)}.`);
            await SqsUtils.deleteMessage(record);
        } else {
            log.error(`An unexpected error occurred while processing event: ${JSON.stringify(e)}`);
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

    const webhooks: Webhook[] = await Webhook.list(event.userId, true);
    log.info(`Retrieved Webhooks:\n${JSON.stringify(webhooks.map(webhook => ({
        ...webhook,
        secrets: webhook.secrets.map(secret => ({...secret, secret: getSecretLastFour(secret.secret)}))
    })))}.`); // todo - need to obfuscate secrets.

    const deliveredWebhookIds: string[] = event.deliveredWebhookIds ? Object.assign([], event.deliveredWebhookIds) : [];
    const webhooksToProcess = webhooks.filter(webhook => webhook.active && deliveredWebhookIds.indexOf(webhook.id) === -1);
    const failedWebhookIds: string[] = [];
    for (const webhook of webhooksToProcess) {
        if (Webhook.matchesEvent(webhook.events, event.type)) {
            log.info(`Webhook ${webhook.id} matches event ${event.type}.`);
            const body = LightrailEvent.toPublicFacingEvent(event);
            const signatures = getSignatures(webhook.secrets.map(s => s.secret), body);
            const call = await sendDataToCallback(signatures, webhook.url, body);

            if (call.statusCode >= 200 && call.statusCode < 300) {
                MetricsLogger.webhookCallSuccess(event.userId);
                log.info(`Successfully called webhook ${webhook.id} for event: ${event.id}.`);
                deliveredWebhookIds.push(webhook.id);
            } else {
                // will need to retry this webhook
                MetricsLogger.webhookCallFailure(event.userId);
                log.info(`Failed calling webhook ${webhook.id} for event: ${event.id}.`);
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