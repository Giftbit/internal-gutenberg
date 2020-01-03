import {dynamodb, objectDynameh} from "../../db/dynamodb";
import * as cassava from "cassava";
import {ParsedProxyResponse} from "./ParsedProxyResponse";
import * as giftbitRoutes from "giftbit-cassava-routes";
import {TestUser} from "./TestUser";
import log = require("loglevel");
import uuid = require("uuid/v4");

const rolesConfig = require("./rolesConfig.json");


if (!process.env["TEST_ENV"]) {
    log.error("Env var TEST_ENV is undefined.  This is not a test environment!");
    throw new Error("Env var TEST_ENV is undefined.  This is not a test environment!");
}

export async function resetDb(): Promise<void> {
    log.trace("deleting existing tables");
    try {
        console.log(process.env["WEBHOOK_ENDPOINTS_TABLE"]);
        console.log(JSON.stringify(objectDynameh, null, 4));
        await dynamodb.deleteTable(objectDynameh.requestBuilder.buildDeleteTableInput()).promise();
    } catch (err) {
        if (err.code !== "ResourceNotFoundException") {
            throw err;
        }
    }

    log.trace("creating tables");
    await dynamodb.createTable(objectDynameh.requestBuilder.buildCreateTableInput()).promise();
}

export function generateId(length?: number): string {
    return (uuid() + uuid()).substring(0, length != null ? length : 20);
}

export const defaultTestUser = new TestUser({
    userId: "default-test-user-TEST",
});

export const testAuthedRequest: <T>(router: cassava.Router, url: string, method: string, body?: any) => Promise<ParsedProxyResponse<T>> = defaultTestUser.request.bind(defaultTestUser);

/**
 * A Cassava Route that enables authorization with the above JWTs.
 */
export const authRoute: cassava.routes.Route = new giftbitRoutes.jwtauth.JwtAuthorizationRoute({
    authConfigPromise: Promise.resolve({secretkey: "secret"}),
    rolesConfigPromise: Promise.resolve(rolesConfig),
    infoLogFunction: () => {
        // too noisy for testing
    },
    errorLogFunction: log.error
});