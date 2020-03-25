import * as aws from "aws-sdk";
import * as dynameh from "dynameh";

export const objectSchema: dynameh.TableSchema = {
    tableName: process.env["WEBHOOK_TABLE"],
    partitionKeyField: "pk",
    partitionKeyType: "string",
    sortKeyField: "sk",
    sortKeyType: "string"
};

export const objectDynameh = dynameh.scope(objectSchema);

export const dynamodb = new aws.DynamoDB({
    apiVersion: "2012-08-10",
    credentials: new aws.EnvironmentCredentials("AWS"),
    endpoint: process.env["TEST_ENV"] === "true" ? "http://localhost:8000" : undefined,
    region: process.env["AWS_REGION"],
});

export function createdDateNow(): string {
    return new Date().toISOString();
}