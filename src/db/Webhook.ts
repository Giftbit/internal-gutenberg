import {dynamodb, objectDynameh, queryAll} from "./dynamodb";
import * as giftbitRoutes from "giftbit-cassava-routes";
import * as cassava from "cassava";
import * as webhookSecrets from "../lambdas/rest/webhookSecretUtils";
import {decryptSecret, encryptSecret} from "../lambdas/rest/webhookSecretUtils";

export interface Webhook {
    id: string;
    url: string;
    secrets?: { secret: string, createdDate: string }[];
    events: string[];
    active: boolean;
    description?: string;
    createdDate: string;
    updatedDate: string;
    createdBy: string;
}

interface DbWebhook extends Webhook {
    userId: string;
    pk: string;
    sk: string;
    encryptedSecrets: { encryptedSecret: string, createdDate: string }[];
}

const WEBHOOK_SORT_KEY = "Webhooks/";

/**
 * Internal API - Operations that can be called from other lambdas within this project.
 */
export namespace Webhook {
    export async function get(userId: string, id: string, showSecret: boolean = false): Promise<Webhook> {
        const req = objectDynameh.requestBuilder.buildGetInput(DbWebhook.getPK(userId), DbWebhook.getSK(id));
        const resp = await dynamodb.getItem(req).promise();
        const dbWebhookEndpoint = objectDynameh.responseUnwrapper.unwrapGetOutput(resp) as DbWebhook;
        if (!dbWebhookEndpoint) {
            throw new giftbitRoutes.GiftbitRestError(404, `Webhook with id '${id}' not found.`, "WebhookNotFound");
        }
        return DbWebhook.fromDbObject(dbWebhookEndpoint, showSecret);
    }

    export async function list(userId: string, showSecret: boolean = false): Promise<Webhook[]> {
        const req = objectDynameh.requestBuilder.buildQueryInput(DbWebhook.getPK(userId), "begins_with", WEBHOOK_SORT_KEY);
        const dbObjects = await queryAll(req);
        return Promise.all(dbObjects.map(o => DbWebhook.fromDbObject(o, showSecret)));
    }

    export async function create(userId: string, teamMemberId: string, webhook: Webhook): Promise<Webhook> {
        webhook.createdDate = new Date().toISOString();
        webhook.updatedDate = webhook.createdDate;
        webhook.secrets = [{secret: webhookSecrets.generateSecret(), createdDate: new Date().toISOString()}];
        webhook.createdBy = teamMemberId;

        const dbWebhookEndpoint: DbWebhook = await DbWebhook.toDbObject(userId, webhook);
        const req = objectDynameh.requestBuilder.buildPutInput(dbWebhookEndpoint);
        objectDynameh.requestBuilder.addCondition(req, {
            attribute: "pk",
            operator: "attribute_not_exists"
        });
        try {
            await dynamodb.putItem(req).promise();
            return webhook;
        } catch (e) {
            if (e.code === "ConditionalCheckFailedException") {
                throw new giftbitRoutes.GiftbitRestError(cassava.httpStatusCode.clientError.CONFLICT, `Webhook with id: ${webhook.id} already exists.`);
            } else {
                throw e;
            }
        }
    }

    export async function update(userId: string, webhook: Webhook): Promise<any> {
        webhook.updatedDate = new Date().toISOString();

        const dbWebhookEndpoint: Webhook = await DbWebhook.toDbObject(userId, webhook);
        const req = objectDynameh.requestBuilder.buildPutInput(dbWebhookEndpoint);
        const resp = await dynamodb.putItem(req).promise();

        return objectDynameh.responseUnwrapper.unwrapGetOutput(resp);
    }

    export function matchesEvent(eventSubscriptions: string[], eventType: string): boolean {
        for (const eventSubscription of eventSubscriptions) {
            if (eventSubscription === "*") {
                return true;
            } else if (eventSubscription.length >= 2 && eventSubscription.slice(-2) === ".*") {
                // subscribedEvent without the .* suffix must match the event until the .*
                const lengthToCheck = eventSubscription.length - 2;
                return eventSubscription.slice(0, lengthToCheck) === eventType.slice(0, lengthToCheck);
            } else {
                // have to totally match
                if (eventSubscription === eventType) {
                    return true;
                }
            }
        }
        return false;
    }
}

namespace DbWebhook {
    export async function fromDbObject(o: DbWebhook, showSecret: boolean = false): Promise<Webhook> {
        if (!o) {
            return null;
        }
        const webhook = {
            ...o
        };
        delete webhook.userId;
        delete webhook.pk;
        delete webhook.sk;

        if (showSecret) {
            webhook.secrets = await Promise.all(o.encryptedSecrets.map(async (s) => ({
                secret: await decryptSecret(s.encryptedSecret),
                createdDate: s.createdDate
            })));
        }
        delete webhook.encryptedSecrets;

        return webhook as Webhook;
    }

    export async function toDbObject(userId: string, webhook: Webhook): Promise<DbWebhook> {
        if (!webhook) {
            return null;
        }
        return {
            ...webhook,
            encryptedSecrets: await Promise.all(webhook.secrets.map(async (s) => ({
                encryptedSecret: await encryptSecret(s.secret),
                createdDate: s.createdDate
            }))),
            secrets: webhook.secrets.map(s => ({secret: getSecretLastFour(s.secret), createdDate: s.createdDate})),
            userId: userId,
            pk: getPK(userId),
            sk: getSK(webhook.id)
        };
    }

    export function getPK(userId: string): string {
        return "Accounts/" + userId;
    }

    export function getSK(webhookEndpointId: string): string {
        return WEBHOOK_SORT_KEY + webhookEndpointId;
    }
}

export function getSecretLastFour(secret: string) {
    return "…" + Array.from(secret).slice(-4).join("");
}