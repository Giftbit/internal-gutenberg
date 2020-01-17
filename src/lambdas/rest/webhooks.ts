import * as cassava from "cassava";
import * as giftbitRoutes from "giftbit-cassava-routes";
import {Webhook} from "../../db/Webhook";
import {generateSecret} from "./webhookSecretUtils";
import list = Webhook.list;

export function installWebhookRest(router: cassava.Router): void {

    router.route("/v2/webhooks")
        .method("GET")
        .handler(async evt => {
            const auth: giftbitRoutes.jwtauth.AuthorizationBadge = evt.meta["auth"];
            auth.requireScopes("lightrailV2:webhooks:list");
            auth.requireIds("teamMemberId");
            const showSecret: boolean = (evt.queryStringParameters.showSecret === "true");

            return {
                statusCode: cassava.httpStatusCode.success.OK,
                body: await list(auth.userId, showSecret)
            };
        });

    router.route("/v2/webhooks")
        .method("POST")
        .handler(async evt => {
            const auth: giftbitRoutes.jwtauth.AuthorizationBadge = evt.meta["auth"];
            auth.requireScopes("lightrailV2:webhooks");
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
            const showSecret: boolean = (evt.queryStringParameters.showSecret === "true");

            return {
                statusCode: cassava.httpStatusCode.success.OK,
                body: await Webhook.get(auth.userId, evt.pathParameters.id, showSecret)
            };
        });

    router.route("/v2/webhooks/{id}")
        .method("PATCH")
        .handler(async evt => {
            const auth: giftbitRoutes.jwtauth.AuthorizationBadge = evt.meta["auth"];
            auth.requireScopes("lightrailV2:webhooks:get");
            auth.requireIds("teamMemberId");

            let webhookUpdates: Partial<Webhook> = evt.body;
            // todo - json schema validation

            const webhook = await Webhook.get(auth.userId, evt.pathParameters.id);
            const updatedWebhook = {...webhook, ...webhookUpdates};
            await Webhook.update(auth.userId, updatedWebhook);
            return {
                statusCode: cassava.httpStatusCode.success.OK,
                body: updatedWebhook
            };
        });

    router.route("/v2/webhooks/{id}/secrets")
        .method("POST")
        .handler(async evt => {
            const auth: giftbitRoutes.jwtauth.AuthorizationBadge = evt.meta["auth"];
            auth.requireScopes("lightrailV2:webhooks:get");
            auth.requireIds("teamMemberId");

            const webhook = await Webhook.get(auth.userId, evt.pathParameters.id, true);
            webhook.secrets.push(generateSecret());

            await Webhook.update(auth.userId, webhook);
            return {
                statusCode: cassava.httpStatusCode.success.CREATED,
                body: webhook
            };
        });

    router.route("/v2/webhooks/{id}/secrets/{secret}")
        .method("DELETE")
        .handler(async evt => {
            const auth: giftbitRoutes.jwtauth.AuthorizationBadge = evt.meta["auth"];
            auth.requireScopes("lightrailV2:webhooks:get");
            auth.requireIds("teamMemberId");

            const webhook = await Webhook.get(auth.userId, evt.pathParameters.id, true);
            if (webhook.secrets.find(s => s === evt.pathParameters.secret)) {
                webhook.secrets = webhook.secrets.filter(s => s !== evt.pathParameters.secret);
            } else {
                throw new giftbitRoutes.GiftbitRestError(cassava.httpStatusCode.clientError.CONFLICT, `Webhook with id: ${webhook.id} already exists.`);
            }
            return {
                statusCode: cassava.httpStatusCode.success.OK,
                body: webhook
            };
        });
}