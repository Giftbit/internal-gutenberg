import * as superagent from "superagent";

export async function sendDataToCallback<T>(signatures: string, url: string, body?: any): Promise<ParsedProxyResponse<T>> {
    const request = superagent.post(url).send(body);
    request.set("Lightrail-Signature", signatures);
    request.set("Content-Type", "application/json");
    request.timeout({
        response: 4000,
        deadline: 6000
    });

    let resp;
    try {
        resp = await request;
    } catch (e) {
        resp = {
            statusCode: e.status,
            body: e.response ? JSON.parse(e.response.text) : {}
        };
    }


    console.log("resp " + JSON.stringify(resp));
    return {
        statusCode: resp.statusCode,
        headers: resp.headers,
        body: resp.body
    };
}

export interface ParsedProxyResponse<T> {
    statusCode: number;
    headers: {
        [key: string]: string;
    };
    body: T;
}