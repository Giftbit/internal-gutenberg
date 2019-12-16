import * as cassava from "cassava";
import * as giftbitRoutes from "giftbit-cassava-routes";
import {Webhook} from "../../../db/Webhook";

export function installWebhookRest(router: cassava.Router): void {

    // todo
    router.route("/v2/webhooks")
        .method("GET")
        .handler(async evt => {
            const auth: giftbitRoutes.jwtauth.AuthorizationBadge = evt.meta["auth"];
            auth.requireScopes("lightrailV2:webhooks:list");
            auth.requireIds("teamMemberId");


        });

    // todo
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

    // todo
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
}