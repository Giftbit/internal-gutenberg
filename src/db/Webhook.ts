import {dynamodb, objectDynameh, queryAll} from "./dynamodb";
import * as giftbitRoutes from "giftbit-cassava-routes";
import * as cassava from "cassava";
import * as webhookSecrets from "../lambdas/rest/webhookSecretUtils";
import {decryptSecret, encryptSecret} from "../lambdas/rest/webhookSecretUtils";

export interface Webhook {
    id: string;
    url: string;
    secrets?: string[];
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
    encryptedSecrets: string[];
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
            throw new giftbitRoutes.GiftbitRestError(404, `Value with id '${id}' not found.`, "WebhookNotFound");
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
        webhook.secrets = [webhookSecrets.generateSecret()];
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

    export function matchesEvent(subscribedEvents: string[], type: string): boolean {
        for (const subscribedEvent of subscribedEvents) {
            if (subscribedEvent === "*") {
                return true;
            } else if (subscribedEvent.length > 1 && subscribedEvent.slice(-2) === ".*") {
                // subscribedEvent without the .* suffix must match the event until the .*
                const suffixLessSubscription = subscribedEvent.slice(0, subscribedEvent.length - 2);
                return suffixLessSubscription === type.slice(0, suffixLessSubscription.length);
            } else {
                // have to totally match
            }
        }
        return subscribedEvents.indexOf(type) >= 0;
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
            webhook.secrets = await Promise.all(o.encryptedSecrets.map(s => decryptSecret(s)));
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
            encryptedSecrets: await Promise.all(webhook.secrets.map(s => encryptSecret(s))),
            secrets: webhook.secrets.map(s => getSecretLastFour(s)),
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

// export function matchesEvent(type: string) {
//     function getParentScope(scope: string): string {
//         if (!scope || typeof scope !== "string") {
//             return null;
//         }
//
//         const lastSeparatorIx = scope.lastIndexOf(":");
//         if (lastSeparatorIx === -1) {
//             return null;
//         }
//
//         return scope.substring(0, lastSeparatorIx);
//     }
//
//     /**
//      * Returns true if this badge contains the given scope or any parent of the scope.
//      */
//     for (; type; type = getParentScope(type)) {
//         if (this.effectiveScopes.indexOf(type) !== -1) {
//             return true;
//         }
//     }
//     return false;
// }