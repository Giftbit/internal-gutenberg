import * as awslambda from "aws-lambda";
import {LightrailEvent, sqsRecordToLightrailEvent} from "./LightrailEvent";
import {DeleteMessageError} from "./errors/DeleteMessageError";
import {SqsUtils} from "./sqsUtils";
import {Webhook} from "../../db/Webhook";
import {getSignatures} from "./signatureUtils";
import {sendDataToCallback} from "./callbackUtils";

export async function processSQSRecord(record: awslambda.SQSRecord): Promise<void> {
    const lightrailEvent: LightrailEvent = sqsRecordToLightrailEvent(record);
    try {
        await processLightrailEvent(lightrailEvent);
    } catch (e) {
        if (e instanceof DeleteMessageError) {
            await SqsUtils.deleteMessage(record)
        } else {
            // todo - exponentially backoff message visibility
            // todo - what about the case when we need to update which webhooks were successful?
        }
    }

    // success = delete message
    // unknown error = exponentially backoff


}

export async function processLightrailEvent(event: LightrailEvent): Promise<void> {
    if (!event.userid) {
        throw new DeleteMessageError(`Event ${JSON.stringify(event)} is missing a userid. It cannot be processed. Deleting message from queue.`)
    }

    const webhooks: Webhook[] = await Webhook.list(event.userid);

    // event might have successfully delivered callbacks if there are multiple webhooks and at least 1 succeeds and 1 fails
    for (const webhook of webhooks) {
        if (Webhook.matchesEvent(webhook.events, event.type)) {
            const signatures = getSignatures(webhook.secrets, event.data);
            const call = await sendDataToCallback(signatures, webhook.url, event.data); // todo - what exactly do we send?
            if (call.statusCode >= 200 && call.statusCode < 300) {
                // success.
            } else {
                // need to retry.
            }
        }
    }
}