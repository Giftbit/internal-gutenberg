import * as cassava from "cassava";
import {installWebhookRest} from "./webhooks";

/**
 * Install REST routes that require valid authorization.
 */
export function installAuthedRestRoutes(router: cassava.Router): void {
    installWebhookRest(router);
}