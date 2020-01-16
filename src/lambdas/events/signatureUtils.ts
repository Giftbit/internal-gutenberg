import * as cryptojs from "crypto-js";

/**
 * Returns comma separated list.
 * @param secrets
 * @param payload
 */
export function getSignatures(secrets: string[], payload: any) {
    // payload should maybe be a JSON string?
    return secrets.map(secret => cryptojs.SHA256(payload, secret)).join(",");
}