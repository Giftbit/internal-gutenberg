import {dynamodb, objectDynameh, queryAll} from "./dynamodb";
import * as giftbitRoutes from "giftbit-cassava-routes";
import * as cassava from "cassava";
import * as webhookSecrets from "../lambdas/rest/webhooks/webhookSecretUtils";
import {decryptSecret, encryptSecret} from "../lambdas/rest/webhooks/webhookSecretUtils";

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
}

const SECRET_LENGTH = 15;

const WEBHOOK_SORT_KEY = "Webhooks/";

/**
 * Internal API - Operations that can be called from other lambdas within this project.
 */
export namespace Webhook {
    export async function get(auth: giftbitRoutes.jwtauth.AuthorizationBadge, id: string): Promise<Webhook> {
        const req = objectDynameh.requestBuilder.buildGetInput(DbWebhook.getPK(auth), DbWebhook.getSK(id));
        const resp = await dynamodb.getItem(req).promise();
        const dbWebhookEndpoint = objectDynameh.responseUnwrapper.unwrapGetOutput(resp) as DbWebhook;
        if (!dbWebhookEndpoint) {
            throw new giftbitRoutes.GiftbitRestError(404, `Value with id '${id}' not found.`, "WebhookNotFound");
        }
        return DbWebhook.fromDbObject(dbWebhookEndpoint);
    }

    export async function list(auth: giftbitRoutes.jwtauth.AuthorizationBadge): Promise<Webhook[]> {
        const req = objectDynameh.requestBuilder.buildQueryInput(DbWebhook.getPK(auth), "begins_with", WEBHOOK_SORT_KEY);
        const dbObjects = await queryAll(req);
        return Promise.all(dbObjects.map(DbWebhook.fromDbObject));
    }

    export async function create(auth: giftbitRoutes.jwtauth.AuthorizationBadge, webhook: Webhook): Promise<any> {
        webhook.createdDate = new Date().toISOString();
        webhook.updatedDate = webhook.createdDate;
        webhook.secrets = [webhookSecrets.generateSecret(SECRET_LENGTH)];
        webhook.createdBy = auth.teamMemberId;

        const dbWebhookEndpoint: Webhook = await DbWebhook.toDbObject(auth, webhook);
        const req = objectDynameh.requestBuilder.buildPutInput(dbWebhookEndpoint);
        objectDynameh.requestBuilder.addCondition(req, {
            attribute: "pk",
            operator: "attribute_not_exists"
        });
        try {
            const resp = await dynamodb.putItem(req).promise();
            return objectDynameh.responseUnwrapper.unwrapGetOutput(resp);
        } catch (e) {
            if (e.code === "ConditionalCheckFailedException") {
                throw new giftbitRoutes.GiftbitRestError(cassava.httpStatusCode.clientError.CONFLICT, `Webhook with id: ${webhook.id} already exists.`)
            } else {
                throw e;
            }
        }
    }

    export async function update(auth: giftbitRoutes.jwtauth.AuthorizationBadge, webhook: Webhook): Promise<any> {
        webhook.updatedDate = new Date().toISOString();

        const dbWebhookEndpoint: Webhook = await DbWebhook.toDbObject(auth, webhook);
        const req = objectDynameh.requestBuilder.buildPutInput(dbWebhookEndpoint);
        const resp = await dynamodb.putItem(req).promise();

        return objectDynameh.responseUnwrapper.unwrapGetOutput(resp);
    }
}

namespace DbWebhook {
    export async function fromDbObject(o: DbWebhook): Promise<Webhook> {
        if (!o) {
            console.log("this is happening");
            return null;
        }
        const webhookEndpoint = {
            ...o,
            secrets: await Promise.all(o.secrets.map(s => decryptSecret(s)))
        };
        delete webhookEndpoint.userId;
        delete webhookEndpoint.pk;
        delete webhookEndpoint.sk;
        return webhookEndpoint as Webhook;
    }

    export async function toDbObject(auth: giftbitRoutes.jwtauth.AuthorizationBadge, webhookEndpoint: Webhook): Promise<DbWebhook> {
        if (!webhookEndpoint) {
            return null;
        }
        return {
            ...webhookEndpoint,
            secrets: await Promise.all(webhookEndpoint.secrets.map(s => encryptSecret(s))),
            userId: auth.userId,
            pk: getPK(auth),
            sk: getSK(webhookEndpoint.id)
        };
    }

    export function getPK(auth: giftbitRoutes.jwtauth.AuthorizationBadge): string {
        return "Accounts/" + auth.userId;
    }

    export function getSK(webhookEndpointId: string): string {
        return WEBHOOK_SORT_KEY + webhookEndpointId;
    }
}