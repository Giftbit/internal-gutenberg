import {LightrailEvent} from "./model/LightrailEvent";
import {DeleteMessageError} from "./errors/DeleteMessageError";
import {Webhook} from "../../db/Webhook";
import {getSignatures} from "./signatureUtils";
import {MetricsLogger} from "../../utils/metricsLogger";
import {postData} from "../../utils/httpUtils";
import log = require("loglevel");

export async function dispatch(event: LightrailEvent): Promise<{ deliveredWebhookIds: string[], failedWebhookIds: string[] }> {
    if (!event.userId) {
        throw new DeleteMessageError(`Event ${JSON.stringify(event)} is missing a userid. It cannot be processed. Deleting message from queue.`);
    }
    if (!event.type) {
        throw new DeleteMessageError(`Event ${JSON.stringify(event)} is missing a type. It cannot be processed. Deleting message from queue.`);
    }

    const webhooks: Webhook[] = await Webhook.list(event.userId, true);
    log.info(`Retrieved Webhooks: ${webhooks.map(Webhook.toStringSafe)}.`);

    const deliveredWebhookIds: string[] = event.deliveredWebhookIds ? Object.assign([], event.deliveredWebhookIds) : [];
    const webhooksToProcess = webhooks.filter(webhook => webhook.active && deliveredWebhookIds.indexOf(webhook.id) === -1);
    const failedWebhookIds: string[] = [];

    for (const webhook of webhooksToProcess) {

        if (Webhook.matchesEvent(webhook.events, event.type)) {
            log.info(`Webhook ${webhook.id} matches event ${event.type}.`);
            const body = LightrailEvent.toPublicFacingEvent(event);
            const signatures = getSignatures(webhook.secrets.map(s => s.secret), body);
            const call = await postData(signatures, webhook.url, body);

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