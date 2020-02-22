import * as awslambda from "aws-lambda";
import * as logPrefix from "loglevel-plugin-prefix";
import * as giftbitRoutes from "giftbit-cassava-routes";
import {processEvent} from "./eventProcessor";
import {GetSecretValueResponse} from "aws-sdk/clients/secretsmanager";
import {initializeSecretEncryptionKey} from "../rest/webhookSecretUtils";
import * as aws from "aws-sdk";
import {LightrailEvent} from "./LightrailEvent";
import {SqsUtils} from "./sqsUtils";
import {DeleteMessageError} from "./errors/DeleteMessageError";
import log = require("loglevel");

// Wrapping console.log instead of binding (default behaviour for loglevel)
// Otherwise all log calls are prefixed with the requestId from the first
// request the lambda received (AWS modifies log calls, loglevel binds to the
// version of console.log that exists when it is initialized).
// See https://github.com/pimterry/loglevel/blob/master/lib/loglevel.js
// tslint:disable-next-line:no-console
log.methodFactory = () => (...args) => console.log(...args);

// Prefix log messages with the level.
logPrefix.reg(log);
logPrefix.apply(log, {
    format: (level, name, timestamp) => {
        return `[${level}]`;
    },
});

// Set the log level when running in Lambda.
log.setLevel(log.levels.INFO);

const secretsManager = new aws.SecretsManager();
const secretEncryptionKey: Promise<GetSecretValueResponse> = secretsManager.getSecretValue({SecretId: process.env["SECRET_ENCRYPTION_KEY"]}).promise();
initializeSecretEncryptionKey(Promise.resolve(secretEncryptionKey));

/**
 * Uses SQS as a Trigger. Simply passes any SQS Messages onto the SQS Processor.
 */
async function handleSqsMessages(evt: awslambda.SQSEvent, ctx: awslambda.Context): Promise<any> {
    log.info("Received: " + evt.Records.length + " records.");
    let throwErrorAtEndToPreventDeletionOfRecords: boolean = false;
    for (const record of evt.Records) {
        log.info(JSON.stringify(record, null, 4));
        const event: LightrailEvent = LightrailEvent.parseFromSQSRecord(record);
        try {
            const result = await processEvent(event, parseInt(record.attributes.SentTimestamp));
            if (result.action === "DELETE") {
                await SqsUtils.deleteMessage(record);

            } else if (result.action === "BACKOFF") {
                await SqsUtils.backoff(record);
                throwErrorAtEndToPreventDeletionOfRecords = true;
            } else if (result.action === "REQUEUE") {
                await SqsUtils.sendMessage(result.newMessage);
                await SqsUtils.deleteMessage(record);
            } else {
                // not possible
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
                throwErrorAtEndToPreventDeletionOfRecords = true;
            }
        }
    }
    if (throwErrorAtEndToPreventDeletionOfRecords) {
        throw new Error("A message needed to be re-queued.")
    }
}

// Export the lambda handler with Sentry error logging supported.
export const handler = giftbitRoutes.sentry.wrapLambdaHandler({
    handler: handleSqsMessages,
    logger: log.error,
    secureConfig: giftbitRoutes.secureConfig.fetchFromS3ByEnvVar<any>("SECURE_CONFIG_BUCKET", "SECURE_CONFIG_KEY_SENTRY")
});