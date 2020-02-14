import * as cassava from "cassava";
import * as giftbitRoutes from "giftbit-cassava-routes";
import {Webhook, WebhookSecret} from "../../db/Webhook";
import {getNewWebhookSecret} from "./webhookSecretUtils";
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

            // todo - json schema validation

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

            let webhookUpdates: Partial<Webhook> = evt.body;
            // todo - json schema validation
            // can't change secrets

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
            webhook.secrets.push(getNewWebhookSecret());

            await Webhook.update(auth.userId, webhook);
            return {
                statusCode: cassava.httpStatusCode.success.CREATED,
                body: webhook
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