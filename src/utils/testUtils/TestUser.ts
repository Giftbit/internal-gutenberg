import * as cassava from "cassava";
import * as chai from "chai";
import {AuthorizationBadge} from "giftbit-cassava-routes/dist/jwtauth";
import {generateId} from "./index";
import {ParsedProxyResponse} from "./ParsedProxyResponse";

export class TestUser {
    userId: string;
    teamMemberId: string;
    stripeAccountId: string | null;
    jwt: string;
    auth: AuthorizationBadge;

    constructor(options?: {
        userId?: string;
        teamMemberId?: string;
        stripeAccountId?: string;
    }) {
        this.userId = options && options.userId || `user-${generateId()}-TEST`;
        this.teamMemberId = options && options.teamMemberId || this.userId;
        this.stripeAccountId = options && options.stripeAccountId || null;
        this.auth = new AuthorizationBadge({
            "g": {
                "gui": this.userId,
                "gmi": this.teamMemberId,
                "tmi": this.userId,
            },
            "iat": "2017-03-07T18:34:06.603+0000",
            "jti": `badge-${generateId()}`,
            "scopes": [],
            "roles": [
                "accountManager",
                "contactManager",
                "customerServiceManager",
                "customerServiceRepresentative",
                "pointOfSale",
                "programManager",
                "promoter",
                "reporter",
                "securityManager",
                "teamAdmin",
                "webPortal"
            ]
        });
        this.jwt = this.auth.sign("secret");
    }

    async request<T>(router: cassava.Router, url: string, method: string, body?: any): Promise<ParsedProxyResponse<T>> {
        const resp = await cassava.testing.testRouter(router, cassava.testing.createTestProxyEvent(url, method, {
            headers: {
                Authorization: `Bearer ${this.jwt}`
            },
            body: body && JSON.stringify(body) || undefined
        }));

        chai.assert.equal(resp.headers["Content-Type"], "application/json");

        return {
            statusCode: resp.statusCode,
            headers: resp.headers,
            body: resp.body && JSON.parse(resp.body) || undefined,
            bodyRaw: resp.body
        };
    }
}
