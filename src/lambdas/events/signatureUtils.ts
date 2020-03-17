import * as cryptojs from "crypto-js";

/**
 * Returns comma separated list.
 * @param secrets
 * @param payload
 */
export function getSignatures(secrets: string[], payload: object): string {
    // payload should maybe be a JSON string?
    return secrets.map(secret => cryptojs.SHA256(JSON.stringify(payload), secret)).join(",");
}