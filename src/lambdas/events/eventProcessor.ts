import {LightrailEvent} from "./model/LightrailEvent";
import {sameElements} from "../../utils/arrayUtils";
import {ProcessEventResult} from "./model/ProcessEventResult";
import {sendEvent} from "./eventSender";
import log = require("loglevel");

export async function processEvent(event: LightrailEvent, sentTimestamp: number): Promise<ProcessEventResult> {
    log.info(`Processing event: ${JSON.stringify(event)}.`);
    const result = await sendEvent(event);

    log.info(`Finished processing event ${event.id}. Result: ${JSON.stringify(result)}.`);
    if (result.failedWebhookIds.length > 0) {
        if (sameElements(result.deliveredWebhookIds, event.deliveredWebhookIds)) {
            const timeSinceFirstAttempt = new Date().getTime() - sentTimestamp;
            if (timeSinceFirstAttempt > 259200000) {
                // exceeded 3 days - todo: consider disabling the webhook at this point.
                log.info("Too many third party non-2xx response. Exceeded 3 days. Will delete message. Elapsed time (ms): ", timeSinceFirstAttempt);
                return {action: "DELETE"};
            } else {
                log.info("Third party non-2xx response received but hasn't exceed 3 days. Elapsed time (ms): ", timeSinceFirstAttempt);
                return {action: "BACKOFF"};
            }
        } else {
            event.deliveredWebhookIds = result.deliveredWebhookIds;
            log.info("Message needs to be re-queued since need the list of deliveredWebhookIds must be updated.", JSON.stringify(event));
            return {
                action: "REQUEUE",
                newMessage: LightrailEvent.toSQSSendMessageRequest(event, 30 /* the call to the webhook just failed so delay a little bit. 30 seconds is quite arbitrary.*/)
            };
        }
    } else {
        log.info(`No failing webhookIds so deleting event ${event.id}.`);
        return {action: "DELETE"};
    }
}