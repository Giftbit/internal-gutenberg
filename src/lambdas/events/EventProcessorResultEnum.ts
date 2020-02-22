import {SendMessageRequest} from "aws-sdk/clients/sqs";

export type ProcessEventResult = DeleteMessage | BackoffMessage | RequeueAsNewMessage;

export interface DeleteMessage {
    action: "DELETE"
}

export interface BackoffMessage {
    action: "BACKOFF"
}

export interface RequeueAsNewMessage {
    action: "REQUEUE";
    newMessage: SendMessageRequest;
}