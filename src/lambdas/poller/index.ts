import * as awslambda from "aws-lambda";
import * as giftbitRoutes from "giftbit-cassava-routes";
import * as aws from "aws-sdk";
import * as logPrefix from "loglevel-plugin-prefix";
import {SqsUtils} from "../events/sqsUtils";
import {InvokeAsyncRequest} from "aws-sdk/clients/lambda";
import log = require("loglevel");

const stringify = require('json-stringify-safe');

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

const lambda = new aws.Lambda();

async function handleScheduleEvent(evt: awslambda.CloudFormationCustomResourceEvent, ctx: awslambda.Context): Promise<any> {
    while (ctx.getRemainingTimeInMillis() > 25000 /* 25 seconds */) {
        log.info("getRemainingTimeInMillis" + ctx.getRemainingTimeInMillis());

        let messages = await SqsUtils.receiveMessage(20);
        log.info(JSON.stringify(messages));
        log.info(`Received ${messages.Messages?.length} messages.`);

        if (messages.Messages?.length > 0) {
            const invocationRequest: InvokeAsyncRequest = {
                FunctionName: process.env["EVENT_FUNCTION"],
                InvokeArgs: JSON.stringify(messages.Messages)
            };
            try {
                log.info(`attempting to invoke ${JSON.stringify(invocationRequest)}.`);
                const res = await lambda.invokeAsync(invocationRequest, function (err, data) {
                    if (err) console.log(err, err.stack); // an error occurred
                    else console.log(data);           // successful response
                });
                log.info(stringify(res));
            } catch (e) {
                log.error("Error thrown during invoke." + e)
            }
        }
    }
}

// Export the lambda handler with Sentry error logging supported.
export const handler = giftbitRoutes.sentry.wrapLambdaHandler({
    handler: handleScheduleEvent,
    logger: log.error,
    secureConfig: giftbitRoutes.secureConfig.fetchFromS3ByEnvVar<any>("SECURE_CONFIG_BUCKET", "SECURE_CONFIG_KEY_SENTRY")
});
