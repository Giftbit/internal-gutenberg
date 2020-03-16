import {LightrailEvent} from "./model/LightrailEvent";
import {sameElements} from "../../utils/arrayUtils";
import {ProcessEventResult} from "./model/ProcessEventResult";
import {sendEvent} from "./eventSender";
import * as giftbitRoutes from "giftbit-cassava-routes";
import log = require("loglevel");

export async function processEvent(event: LightrailEvent, sentTimestamp: number): Promise<ProcessEventResult> {
    const result = await sendEvent(event);

    if (result.failedWebhookIds.length > 0) {
        if (sameElements(result.deliveredWebhookIds, event.deliveredWebhookIds)) {
            const timeSinceFirstAttempt = new Date().getTime() - sentTimestamp;
            if (timeSinceFirstAttempt > 259200000) {
                const message = `Too many third party non-2xx response. FailedWebhookIds: ${result.failedWebhookIds}. Exceeded 3 days. Will delete message. Elapsed time (ms): ${timeSinceFirstAttempt}. Id: ${event.id}.`;
                log.warn(message);
                giftbitRoutes.sentry.sendErrorNotification(new Error(message));
                return {action: "DELETE"};
            } else {
                log.info(`Received non-2xx response from third party. FailedWebhookIds: ${result.failedWebhookIds}. Third party non-2xx response received but hasn't exceed 3 days. Message must be backed off. Elapsed time (ms): `, timeSinceFirstAttempt);
                return {action: "BACKOFF"};
            }
        } else {
            const eventWithNewDeliveries = JSON.parse(JSON.stringify(event));
            eventWithNewDeliveries.deliveredWebhookIds = result.deliveredWebhookIds;
            log.info(`Message needs to be re-queued since need the list of deliveredWebhookIds must be updated. Result ${JSON.stringify(result)}.`);
            return {
                action: "REQUEUE",
                newMessage: LightrailEvent.toSQSSendMessageRequest(eventWithNewDeliveries, 30 /* the call to the webhook just failed so delay a little bit. 30 seconds is quite arbitrary.*/)
            };
        }
    } else {
        log.info(`No failing webhookIds so deleting event ${event.id}. Delivered webhook ids: ${result.deliveredWebhookIds}.`);
        return {action: "DELETE"};
    }
}