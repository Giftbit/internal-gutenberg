import {dynamodb, objectDynameh} from "./dynamodb";
import * as giftbitRoutes from "giftbit-cassava-routes";
import {DbWebhook} from "./Webhook";

export interface Webhook {
    id: string;
    url: string;
    secret?: string;
    events: string[];
    active: boolean;
    createdDate: string;
    updatedDate: string;
    createdBy: string;
}

export interface DbWebhook extends Webhook {
    userId: string;
    pk: string;
    sk: string;
}

export namespace Webhook {

    export function fromDbObject(o: DbWebhook): Webhook {
        if (!o) {
            return null;
        }
        const webhookEndpoint = {...o};
        delete webhookEndpoint.userId;
        delete webhookEndpoint.pk;
        delete webhookEndpoint.sk;
        return webhookEndpoint as any;
    }

    export function toDbObject(auth: giftbitRoutes.jwtauth.AuthorizationBadge, webhookEndpoint: Webhook): DbWebhook {
        if (!webhookEndpoint) {
            return null;
        }
        return {
            ...webhookEndpoint,
            ...{
                userId: auth.userId,
                pk: getPK(auth),
                sk: getSK(webhookEndpoint.id),
                createdBy: auth.teamMemberId
            }
        };
    }

    export async function get(auth: giftbitRoutes.jwtauth.AuthorizationBadge, webhookEndpointId: string): Promise<Webhook> {
        const req = objectDynameh.requestBuilder.buildGetInput(getPK(auth), getSK(webhookEndpointId));
        const resp = await dynamodb.getItem(req).promise();
        const dbWebhookEndpoint = objectDynameh.responseUnwrapper.unwrapGetOutput(resp) as DbWebhook;
        return Webhook.fromDbObject(dbWebhookEndpoint);
    }

    export async function create(auth: giftbitRoutes.jwtauth.AuthorizationBadge, webhook: Webhook): Promise<any> {
        webhook.createdDate = new Date().toISOString();
        return await update(auth, webhook);
    }

    export async function update(auth: giftbitRoutes.jwtauth.AuthorizationBadge, webhook: Webhook): Promise<any> {
        webhook.updatedDate = new Date().toISOString();

        const dbWebhookEndpoint: Webhook = toDbObject(auth, webhook);
        const req = objectDynameh.requestBuilder.buildPutInput(dbWebhookEndpoint);
        const resp = await dynamodb.putItem(req).promise();

        return objectDynameh.responseUnwrapper.unwrapGetOutput(resp);
    }

    function getPK(auth: giftbitRoutes.jwtauth.AuthorizationBadge): string {
        return "#Account/" + auth.userId;
    }

    function getSK(webhookEndpointId: string): string {
        return "#WebhookEndpoint/" + webhookEndpointId;
    }
}

