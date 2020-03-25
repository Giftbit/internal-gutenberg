import log = require("loglevel");

/**
 * Legal types of metrics: https://docs.datadoghq.com/integrations/amazon_lambda/#using-cloudwatch-logs
 */
enum MetricsType {
    Histogram = "histogram",
    Count = "count",
    Gauge = "gauge",
    Check = "check"
}

export namespace MetricsLogger {

    /**
     * Received a 200 response from a webhook call.
     */
    export function webhookCallSuccess(userId: string): void {
        logMetric(1, MetricsType.Histogram, `gutenberg.webhook.call.success`, {}, userId);
    }

    /**
     * Received a non-200 response from a webhook.
     */
    export function webhookCallFailure(userId: string): void {
        logMetric(1, MetricsType.Histogram, `gutenberg.webhook.call.failure`, {}, userId);
    }
}

/**
 * Uses Cloudwatch logs to send arbitrary metrics to Datadog: see https://docs.datadoghq.com/integrations/amazon_lambda/#using-cloudwatch-logs for details
 * Log message follows format `MONITORING|<unix_epoch_timestamp_in_seconds>|<value>|<metric_type>|<metric_name>|#<tag_key>:<tag_value>`
 * The tag function_name:<name_of_the_function> is added automatically
 */
function logMetric(value: number, metricType: MetricsType, metricName: string, tags: { [key: string]: string } = {}, userId: string): void {
    let tagString = Object.keys(tags)
        .map(key => `#${key}:${tags[key]}`)
        .join(",");

    tagString += (tagString ? "," : "") +
        `#userId:${userId},` +
        `#liveMode:${!isTestUser(userId)}`;

    log.info(`MONITORING|` +
        `${Math.round(Date.now() / 1000)}|` +
        `${value}|` +
        `${metricType}|` +
        `${metricName}|` +
        `${tagString}`
    );
}

function isTestUser(userId: string): boolean {
    return userId.endsWith("-TEST");
}