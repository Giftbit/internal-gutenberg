import {LightrailEvent} from "./model/LightrailEvent";
import {DeleteMessageError} from "./errors/DeleteMessageError";
import {Webhook} from "../../db/Webhook";
import {getSignatures} from "./signatureUtils";
import {MetricsLogger} from "../../utils/metricsLogger";
import {postData} from "../../utils/httpUtils";
import log = require("loglevel");

export async function sendEvent(event: LightrailEvent): Promise<{ deliveredWebhookIds: string[], failedWebhookIds: string[] }> {
    const webhooks: Webhook[] = await Webhook.list(event.userId, true);

    const deliveredWebhookIds: string[] = event.deliveredWebhookIds ? Object.assign([], event.deliveredWebhookIds) : [];
    const webhooksToProcess = webhooks.filter(webhook => webhook.active && deliveredWebhookIds.indexOf(webhook.id) === -1);
    const failedWebhookIds: string[] = [];

    for (const webhook of webhooksToProcess) {

        if (Webhook.matchesEvent(webhook.events, event.type)) {
            const body = LightrailEvent.toPublicFacingEvent(event);
            const signatures = getSignatures(webhook.secrets.map(s => s.secret), body);
            const call = await postData(signatures, webhook.url, body);

            if (call.statusCode >= 200 && call.statusCode < 300) {
                MetricsLogger.webhookCallSuccess(event.userId);
                deliveredWebhookIds.push(webhook.id);
            } else {
                MetricsLogger.webhookCallFailure(event.userId);
                log.info(`Received non-2xx from webhook ${webhook.id}. Status code: ${call.statusCode}.`);
                failedWebhookIds.push(webhook.id);
            }
        }
    }

    return {deliveredWebhookIds: deliveredWebhookIds, failedWebhookIds: failedWebhookIds};
}