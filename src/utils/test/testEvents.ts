import {LightrailEvent} from "../../lambdas/events/model/LightrailEvent";
import {defaultTestUser, generateId} from "./testUtils";

export namespace TestEvents {
    export function getBasicTestEvent(): LightrailEvent {
        const id = generateId();
        const date = new Date();

        return {
            specVersion: "1.0",
            type: "gutenberg.test.airplane.created", // todo <tim> - try to pick something memorable.
            source: "/gutenberg/tests",
            id: id,
            time: date,
            userId: defaultTestUser.auth.userId,
            dataContentType: "application/json",
            data: {
                simpleProp: "1",
                nested: {
                    here: "okay"
                },
                createdDate: date.toISOString()
            }
        };
    }
}