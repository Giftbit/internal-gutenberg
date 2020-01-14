import {LightrailEvent} from "../../lambdas/events/LightrailEvent";
import {defaultTestUser, generateId} from "./testUtils";

export namespace TestEvents {
    export function getBasicTestEvent(): LightrailEvent {
        const id = generateId();
        const date = new Date();

        return {
            specversion: "1.0",
            type: "gutenberg.test.airplane.created", // todo <tim> - try to pick something memorable.
            source: "/gutenberg/tests",
            id: id,
            time: date,
            userid: defaultTestUser.auth.userId,
            datacontenttype: "application/json",
            data: {
                simpleProp: "1",
                nested: {
                    here: "okay"
                },
                createdDate: date.toISOString()
            }
        }
    }
}