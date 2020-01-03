import * as cassava from "cassava";
import * as giftbitRoutes from "giftbit-cassava-routes";
import {Webhook} from "../../../db/Webhook";
import {generateSecret} from "./webhookSecretUtils";
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
                body: await list(auth)
            };
        });

    router.route("/v2/webhooks")
        .method("POST")
        .handler(async evt => {
            const auth: giftbitRoutes.jwtauth.AuthorizationBadge = evt.meta["auth"];
            auth.requireScopes("lightrailV2:webhooks");
            auth.requireIds("teamMemberId");

            let webhook: Webhook = evt.body;
            // todo - json schema validation

            await Webhook.create(auth, webhook);
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
                body: await Webhook.get(auth, evt.pathParameters.id)
            }
        });

    router.route("/v2/webhooks/{id}")
        .method("PATCH")
        .handler(async evt => {
            const auth: giftbitRoutes.jwtauth.AuthorizationBadge = evt.meta["auth"];
            auth.requireScopes("lightrailV2:webhooks:get");
            auth.requireIds("teamMemberId");

            let webhook: Webhook = evt.body;
            // todo - json schema validation

            await Webhook.update(auth, webhook);
            return {
                statusCode: cassava.httpStatusCode.success.OK,
                body: webhook
            }
        });

    // todo - i'm not sure this is necessary.
    router.route("/v2/webhooks/{id}/secret")
        .method("POST")
        .handler(async evt => {
            const auth: giftbitRoutes.jwtauth.AuthorizationBadge = evt.meta["auth"];
            auth.requireScopes("lightrailV2:webhooks:get");
            auth.requireIds("teamMemberId");

            const webhook = await Webhook.get(auth, evt.pathParameters.id);
            webhook.secrets.push(generateSecret(15));

            await Webhook.update(auth, webhook);
            return {
                statusCode: cassava.httpStatusCode.success.CREATED,
                body: webhook
            }
        });

    // todo - this might not be necessary.
    router.route("/v2/webhooks/{id}/secrets/{secret}")
        .method("DELETE")
        .handler(async evt => {
            const auth: giftbitRoutes.jwtauth.AuthorizationBadge = evt.meta["auth"];
            auth.requireScopes("lightrailV2:webhooks:get");
            auth.requireIds("teamMemberId");

            const webhook = await Webhook.get(auth, evt.pathParameters.id);
            if (webhook.secrets.find(s => s === evt.pathParameters.secret)) {
                webhook.secrets = webhook.secrets.filter(s => s !== evt.pathParameters.secret);
            } else {
                throw new giftbitRoutes.GiftbitRestError(cassava.httpStatusCode.clientError.CONFLICT, `Webhook with id: ${webhook.id} already exists.`)
            }
            return {
                statusCode: cassava.httpStatusCode.success.CREATED,
                body: webhook
            }
        });
}