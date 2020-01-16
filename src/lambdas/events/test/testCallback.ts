import * as cassava from "cassava";

export function installTestCallbackRest(router: cassava.Router): void {
    router.route("/v2/tests/callbacks/success")
        .method("POST")
        .handler(async evt => {
            console.log("SDFSDFSDF");
            return {
                statusCode: 200,
                body: {}
            };
        });

    router.route("/v2/tests/callbacks/failure")
        .method("POST")
        .handler(async evt => {
            return {
                statusCode: 404,
                body: {}
            };
        });
}
