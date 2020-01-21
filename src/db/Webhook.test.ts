import {Webhook} from "./Webhook";
import * as chai from "chai";

describe("Webhook", () => {
    describe.only("matches", () => {
        interface MatchTest {
            events: string[];
            event: string;
            matches: boolean;
        }

        const matchTests: MatchTest[] = [
            {events: ["*"], event: "a", matches: true},
            {events: ["a"], event: "a", matches: true},
            {events: ["a"], event: "b", matches: false},
            {events: ["a"], event: "a.b", matches: false},
            {events: ["a.*"], event: "a", matches: true},
            {events: ["a.*"], event: "b", matches: false},
            {events: ["a.*"], event: "a.b", matches: true},
            {events: ["a.b"], event: "a", matches: false},
            {events: ["a.b"], event: "a", matches: false},
            {events: ["a.b"], event: "b", matches: false},
            {events: ["a.b"], event: "a.b", matches: true},
            {events: ["a.b"], event: "b.a", matches: false},
            {events: ["a.b"], event: "a.b.c", matches: false},
            {events: ["a.b.*"], event: "a.b", matches: true},
            {events: ["a.b.*"], event: "a.b.c", matches: true},
        ];

        for (const test of matchTests) {
            it(`matches test: ${JSON.stringify(test)}`, () => {
                chai.assert.equal(Webhook.matchesEvent(test.events, test.event), test.matches);
            });
        }
    });
});