import * as awslambda from "aws-lambda";
import * as logPrefix from "loglevel-plugin-prefix";
import {processSQSRecord} from "./eventProcessor";
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
    }
});

log.setLevel(process.env.LOG_LEVEL as any || log.levels.INFO);

/**
 * Uses SQS as a Trigger. Simply passes any SQS Messages onto the SQS Processor.
 */
async function handleSqsMessages(evt: awslambda.SQSEvent, ctx: awslambda.Context): Promise<any> {
    for (const message of evt.Records) {
        console.log(JSON.stringify(message, null, 4));
        await processSQSRecord(message);
    }
}

// exports.handler = async (event) => {
//     //console.log('Received event:', JSON.stringify(event, null, 2));
//     for (const {messageId, body} of event.Records) {
//         console.log('SQS message %s: %j', messageId, body);
//     }
//     return `Successfully processed ${event.Records.length} messages.`;
// };

// Export the lambda handler with Sentry error logging supported.
export const handler = handleSqsMessages;

/* todo later
export const handler = giftbitRoutes.sentry.wrapLambdaHandler({
    handler: handleScheduleEvent,
    logger: log.error,
    secureConfig: giftbitRoutes.secureConfig.fetchFromS3ByEnvVar<any>("SECURE_CONFIG_BUCKET", "SECURE_CONFIG_KEY_SENTRY")
});
*/