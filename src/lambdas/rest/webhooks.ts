import * as cassava from "cassava";
import * as giftbitRoutes from "giftbit-cassava-routes";
import {Webhook, WebhookSecret} from "../../db/Webhook";
import {getNewWebhookSecret} from "./webhookSecretUtils";
import * as jsonschema from "jsonschema";
import {pick} from "../../utils/pick";
import list = Webhook.list;

export function installWebhookRest(router: cassava.Router): void {

    router.route("/v2/webhooks")
        .method("GET")
        .handler(async evt => {
            const auth: giftbitRoutes.jwtauth.AuthorizationBadge = evt.meta["auth"];
            auth.requireScopes("lightrailV2:webhooks:list");
            auth.requireIds("teamMemberId");

            return {
                statusCode: cassava.httpStatusCode.success.OK,
                body: await list(auth.userId)
            };
        });

    router.route("/v2/webhooks")
        .method("POST")
        .handler(async evt => {
            const auth: giftbitRoutes.jwtauth.AuthorizationBadge = evt.meta["auth"];
            auth.requireScopes("lightrailV2:webhooks:create");
            auth.requireIds("teamMemberId");
            evt.validateBody(webhookCreateSchema);

            const webhook = await Webhook.create(auth.userId, auth.teamMemberId, evt.body);
            return {
                statusCode: cassava.httpStatusCode.success.CREATED,
                body: webhook
            };
        });

    router.route("/v2/webhooks/{id}")
        .method("GET")
        .handler(async evt => {
            const auth: giftbitRoutes.jwtauth.AuthorizationBadge = evt.meta["auth"];
            auth.requireScopes("lightrailV2:webhooks:get");
            auth.requireIds("teamMemberId");

            return {
                statusCode: cassava.httpStatusCode.success.OK,
                body: await Webhook.get(auth.userId, evt.pathParameters.id)
            };
        });

    router.route("/v2/webhooks/{id}")
        .method("PATCH")
        .handler(async evt => {
            const auth: giftbitRoutes.jwtauth.AuthorizationBadge = evt.meta["auth"];
            auth.requireScopes("lightrailV2:webhooks:update");
            auth.requireIds("teamMemberId");

            evt.validateBody(webhookCreateSchema);
            let webhookUpdates: Partial<Webhook> = evt.body;

            let webhook = await Webhook.get(auth.userId, evt.pathParameters.id, true); // show secrets so that the update can properly save.
            const updatedWebhook = {...webhook, ...webhookUpdates};
            await Webhook.update(auth.userId, updatedWebhook);
            return {
                statusCode: cassava.httpStatusCode.success.OK,
                body: await Webhook.get(auth.userId, evt.pathParameters.id) // loo
            };
        });

    router.route("/v2/webhooks/{id}/secrets")
        .method("POST")
        .handler(async evt => {
            const auth: giftbitRoutes.jwtauth.AuthorizationBadge = evt.meta["auth"];
            auth.requireScopes("lightrailV2:webhooks:secrets:create");
            auth.requireIds("teamMemberId");

            const webhook = await Webhook.get(auth.userId, evt.pathParameters.id, true);
            if (webhook.secrets.length === 3) {
                throw new giftbitRoutes.GiftbitRestError(cassava.httpStatusCode.clientError.CONFLICT, `A webhook cannot have more than 3 secrets.`);
            }

            const secret: WebhookSecret = getNewWebhookSecret();
            webhook.secrets.push(secret);

            await Webhook.update(auth.userId, webhook);
            return {
                statusCode: cassava.httpStatusCode.success.CREATED,
                body: secret
            };
        });

    router.route("/v2/webhooks/{id}/secrets/{secretId}")
        .method("GET")
        .handler(async evt => {
            const auth: giftbitRoutes.jwtauth.AuthorizationBadge = evt.meta["auth"];
            auth.requireScopes("lightrailV2:webhooks:secrets:get");
            auth.requireIds("teamMemberId");

            const webhook = await Webhook.get(auth.userId, evt.pathParameters.id, true);

            const secretId = evt.pathParameters.secretId;
            const webhookSecret: WebhookSecret = webhook.secrets.find(s => s.id === secretId);
            if (webhookSecret) {
                return {
                    statusCode: cassava.httpStatusCode.success.OK,
                    body: webhookSecret
                };
            } else {
                throw new giftbitRoutes.GiftbitRestError(cassava.httpStatusCode.clientError.CONFLICT, `Secret with id ${secretId} does not exist.`);
            }

        });

    router.route("/v2/webhooks/{id}/secrets/{secretId}")
        .method("DELETE")
        .handler(async evt => {
            const auth: giftbitRoutes.jwtauth.AuthorizationBadge = evt.meta["auth"];
            auth.requireScopes("lightrailV2:webhooks:secrets:delete");
            auth.requireIds("teamMemberId");

            const webhook = await Webhook.get(auth.userId, evt.pathParameters.id);

            const secretId = evt.pathParameters.secretId;
            if (webhook.secrets.find(s => s.id === secretId)) {
                if (webhook.secrets.length === 1) {
                    throw new giftbitRoutes.GiftbitRestError(cassava.httpStatusCode.clientError.CONFLICT, `A webhook must have at least 1 secret.`);
                }
                webhook.secrets = webhook.secrets.filter(s => s.id !== secretId);
            } else {
                throw new giftbitRoutes.GiftbitRestError(cassava.httpStatusCode.clientError.CONFLICT, `Secret with id ${secretId} does not exist.`);
            }
            await Webhook.update(auth.userId, webhook);
            return {
                statusCode: cassava.httpStatusCode.success.OK,
                body: {}
            };
        });
}

export const webhookCreateSchema: jsonschema.Schema = {
    type: "object",
    additionalProperties: false,
    properties: {
        id: {
            type: "string",
            maxLength: 64,
            minLength: 1,
            pattern: "^[ -~]*$"
        },
        url: {
            type: "uri"
        },
        events: {
            type: ["array"],
            items: {
                type: "string",
                minLength: 1,
                maxLength: 100
            }
        },
        active: {
            type: "boolean"
        }
    },
    required: ["id", "url", "events"]
};

export const webhookUpdateSchema: jsonschema.Schema = {
    type: "object",
    additionalProperties: false,
    properties: {
        ...pick(webhookCreateSchema.properties, "url", "events", "active"),
    },
    required: []
};