import * as cassava from "cassava";
import * as giftbitRoutes from "giftbit-cassava-routes";
import {CreateWebhookParams, Webhook, webhookCreateSchema, WebhookSecret, webhookUpdateSchema} from "../../db/Webhook";
import {getNewWebhookSecret} from "./webhookSecretUtils";
import list = Webhook.list;
import validateUrl = Webhook.validateUrl;

export function installWebhookRest(router: cassava.Router): void {

    router.route("/v2/webhooks")
        .method("GET")
        .handler(async evt => {
            const auth: giftbitRoutes.jwtauth.AuthorizationBadge = evt.meta["auth"];
            auth.requireScopes("lightrailV2:webhooks:list");
            auth.requireIds("teamMemberId");

            return {
                statusCode: cassava.httpStatusCode.success.OK,
                body: (await list(auth.userId)).sort((a, b) => new Date(b.createdDate).getTime() - new Date(a.createdDate).getTime())
            };
        });

    router.route("/v2/webhooks")
        .method("POST")
        .handler(async evt => {
            const auth: giftbitRoutes.jwtauth.AuthorizationBadge = evt.meta["auth"];
            auth.requireScopes("lightrailV2:webhooks:create");
            auth.requireIds("teamMemberId");
            evt.validateBody(webhookCreateSchema);
            const createWebhookParams: CreateWebhookParams = evt.body;

            const webhookCount = await Webhook.count(auth.userId);
            if (webhookCount >= 20) {
                throw new giftbitRoutes.GiftbitRestError(cassava.httpStatusCode.clientError.CONFLICT, `You cannot have more than 20 webhooks. Please delete an existing webhook before creating a new one.`, "TooManyWebhooks");
            }

            const webhook = await Webhook.create(auth.userId, auth.teamMemberId, createWebhookParams);
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

            evt.validateBody(webhookUpdateSchema);
            const webhookUpdates: Partial<Webhook> = evt.body;

            const webhook = await Webhook.get(auth.userId, evt.pathParameters.id, true); // show secrets so that the update can properly save.
            const updatedWebhook = {...webhook, ...webhookUpdates};
            validateUrl(updatedWebhook.url);
            await Webhook.update(auth.userId, updatedWebhook);
            return {
                statusCode: cassava.httpStatusCode.success.OK,
                body: await Webhook.get(auth.userId, evt.pathParameters.id) // loo
            };
        });

    router.route("/v2/webhooks/{id}")
        .method("DELETE")
        .handler(async evt => {
            const auth: giftbitRoutes.jwtauth.AuthorizationBadge = evt.meta["auth"];
            auth.requireScopes("lightrailV2:webhooks:update");
            auth.requireIds("teamMemberId");

            const webhook = await Webhook.get(auth.userId, evt.pathParameters.id);
            await Webhook.del(auth.userId, webhook);
            return {
                statusCode: cassava.httpStatusCode.success.NO_CONTENT,
                body: {}
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
                throw new giftbitRoutes.GiftbitRestError(cassava.httpStatusCode.clientError.CONFLICT, `A webhook cannot have more than 3 secrets.`, "TooManySecrets");
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

            const webhook = await Webhook.get(auth.userId, evt.pathParameters.id, true);

            const secretId = evt.pathParameters.secretId;
            if (webhook.secrets.find(s => s.id === secretId)) {
                if (webhook.secrets.length === 1) {
                    throw new giftbitRoutes.GiftbitRestError(cassava.httpStatusCode.clientError.CONFLICT, `A webhook must have at least 1 secret.`, "TooFewSecrets");
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