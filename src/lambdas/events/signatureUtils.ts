import * as crypto from "crypto";

/**
 * Returns comma separated list.
 */
export function getSignatures(secrets: string[], payload: object): string {
    const payloadString = JSON.stringify(payload);

    return secrets.map(secret => crypto
        .createHmac('sha256', secret)
        .update(payloadString)
        .digest('hex')).join(",");
}