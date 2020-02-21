import * as awslambda from "aws-lambda";
import * as logPrefix from "loglevel-plugin-prefix";
import * as giftbitRoutes from "giftbit-cassava-routes";
import {processSQSRecord} from "./eventProcessor";
import {GetSecretValueResponse} from "aws-sdk/clients/secretsmanager";
import {initializeSecretEncryptionKey} from "../rest/webhookSecretUtils";
import * as aws from "aws-sdk";
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
    for (const message of evt.Records) {
        try {
            console.log(JSON.stringify(message, null, 4));
            await processSQSRecord(message);
        } catch (error) {

        }
    }
}

// Export the lambda handler with Sentry error logging supported.
export const handler = giftbitRoutes.sentry.wrapLambdaHandler({
    handler: handleSqsMessages,
    logger: log.error,
    secureConfig: giftbitRoutes.secureConfig.fetchFromS3ByEnvVar<any>("SECURE_CONFIG_BUCKET", "SECURE_CONFIG_KEY_SENTRY")
});