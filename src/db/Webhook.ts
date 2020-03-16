import {dynamodb, objectDynameh, queryAll} from "./dynamodb";
import * as giftbitRoutes from "giftbit-cassava-routes";
import * as cassava from "cassava";
import {decryptSecret, encryptSecret, getNewWebhookSecret} from "../lambdas/rest/webhookSecretUtils";
import {queryCountAll} from "dynameh/dist/queryHelper";

export interface Webhook extends CreateWebhookParams {
    secrets?: WebhookSecret[];
    createdDate: Date;
    updatedDate: Date;
    createdBy: string;
}

export interface CreateWebhookParams {
    id: string;
    url: string;
    events: string[];
    active: boolean;
}

interface DbWebhook extends Webhook {
    userId: string;
    pk: string;
    sk: string;
    encryptedSecrets: DbWebhookSecret[];
}

export interface WebhookSecret {
    id: string;
    secret: string;
    createdDate: string;
}

interface DbWebhookSecret {
    id: string;
    encryptedSecret: string;
    createdDate: string;
}

const WEBHOOK_SORT_KEY = "Webhooks/";

/**
 * Internal API - Operations that can be called from other lambdas within this project.
 */
export namespace Webhook {

    export async function get(userId: string, id: string, showSecrets: boolean = false): Promise<Webhook> {
        const req = objectDynameh.requestBuilder.buildGetInput(DbWebhook.getPK(userId), DbWebhook.getSK(id));
        const resp = await dynamodb.getItem(req).promise();
        const dbWebhookEndpoint = objectDynameh.responseUnwrapper.unwrapGetOutput(resp) as DbWebhook;
        if (!dbWebhookEndpoint) {
            throw new giftbitRoutes.GiftbitRestError(404, `Webhook with id '${id}' not found.`, "WebhookNotFound");
        }
        return DbWebhook.fromDbObject(dbWebhookEndpoint, showSecrets);
    }

    export async function list(userId: string, showSecrets: boolean = false): Promise<Webhook[]> {
        const req = objectDynameh.requestBuilder.buildQueryInput(DbWebhook.getPK(userId), "begins_with", WEBHOOK_SORT_KEY);
        const dbObjects = await queryAll(req);
        return Promise.all(dbObjects.map(o => DbWebhook.fromDbObject(o, showSecrets)));
    }

    export async function count(userId: string): Promise<number> {
        const req = objectDynameh.requestBuilder.buildQueryInput(DbWebhook.getPK(userId), "begins_with", WEBHOOK_SORT_KEY);
        return await queryCountAll(dynamodb, req);
    }

    export async function create(userId: string, teamMemberId: string, createWebhookParams: CreateWebhookParams): Promise<Webhook> {
        const now = new Date();
        const webhook: Webhook = {
            ...createWebhookParams,
            createdDate: now,
            updatedDate: now,
            secrets: [getNewWebhookSecret()],
            createdBy: teamMemberId,
            active: createWebhookParams.active != null ? createWebhookParams.active : true
        };
        validateUrl(webhook.url);

        const dbWebhookEndpoint: DbWebhook = await DbWebhook.toDbObject(userId, webhook as Webhook);
        const req = objectDynameh.requestBuilder.buildPutInput(dbWebhookEndpoint);
        objectDynameh.requestBuilder.addCondition(req, {
            attribute: "pk",
            operator: "attribute_not_exists"
        });
        try {
            await dynamodb.putItem(req).promise();
            return webhook as Webhook;
        } catch (e) {
            if (e.code === "ConditionalCheckFailedException") {
                throw new giftbitRoutes.GiftbitRestError(cassava.httpStatusCode.clientError.CONFLICT, `Webhook with id: ${webhook.id} already exists.`);
            } else {
                throw e;
            }
        }
    }

    export async function update(userId: string, webhook: Webhook): Promise<any> {
        webhook.updatedDate = new Date();

        const dbWebhookEndpoint: Webhook = await DbWebhook.toDbObject(userId, webhook);
        const req = objectDynameh.requestBuilder.buildPutInput(dbWebhookEndpoint);
        const resp = await dynamodb.putItem(req).promise();

        return objectDynameh.responseUnwrapper.unwrapGetOutput(resp);
    }

    export async function del(userId: string, webhook: Webhook): Promise<any> {
        const dbWebhookEndpoint: Webhook = await DbWebhook.toDbObject(userId, webhook);
        const req = objectDynameh.requestBuilder.buildDeleteInput(dbWebhookEndpoint);
        const resp = await dynamodb.deleteItem(req).promise();

        return objectDynameh.responseUnwrapper.unwrapGetOutput(resp);
    }

    export function matchesEvent(eventSubscriptions: string[], eventType: string): boolean {
        for (const eventSubscription of eventSubscriptions) {
            if (eventSubscription === "*") {
                return true;
            } else if (eventSubscription.length >= 2 && eventSubscription.slice(-2) === ".*") {
                const lengthToCheck = eventSubscription.length - 2;
                return eventSubscription.slice(0, lengthToCheck) === eventType.slice(0, lengthToCheck);
            } else {
                if (eventSubscription === eventType) {
                    return true;
                }
            }
        }
        return false;
    }

    export function validateUrl(url: string) {
        if (url.slice(0, 5) !== "https") {
            throw new giftbitRoutes.GiftbitRestError(cassava.httpStatusCode.clientError.UNPROCESSABLE_ENTITY, `The url must be secure.`, "InsecureWebhookUrl");
        }
    }
}

export namespace DbWebhook {
    export async function fromDbObject(o: DbWebhook, showSecret: boolean = false): Promise<Webhook> {
        if (!o) {
            return null;
        }
        const webhook: Webhook = {
            id: o.id,
            url: o.url,
            secrets: o.secrets,
            events: o.events,
            active: o.active,
            createdDate: o.createdDate,
            updatedDate: o.updatedDate,
            createdBy: o.createdBy,
        };

        if (showSecret) {
            webhook.secrets = await Promise.all(o.encryptedSecrets.map(async (s) => ({
                id: s.id,
                secret: await decryptSecret(s.encryptedSecret),
                createdDate: s.createdDate
            })));
        }

        return webhook;
    }

    export async function toDbObject(userId: string, webhook: Webhook): Promise<DbWebhook> {
        if (!webhook) {
            return null;
        }
        return {
            ...webhook,
            encryptedSecrets: await Promise.all(webhook.secrets.map(async (s) => ({
                id: s.id,
                encryptedSecret: await encryptSecret(s.secret),
                createdDate: s.createdDate
            }))),
            secrets: webhook.secrets.map(s => ({
                id: s.id,
                secret: getSecretLastFour(s.secret),
                createdDate: s.createdDate
            })),
            userId: userId,
            pk: getPK(userId),
            sk: getSK(webhook.id)
        };
    }

    export function getPK(userId: string): string {
        return "Users/" + userId;
    }

    export function getSK(webhookEndpointId: string): string {
        return WEBHOOK_SORT_KEY + webhookEndpointId;
    }
}

export function getSecretLastFour(secret: string) {
    return "…" + Array.from(secret).slice(-4).join("");
}