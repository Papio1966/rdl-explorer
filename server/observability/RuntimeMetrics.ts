import type { RequestContext } from "../runtime/RequestContext.ts";
import { requestDurationMs } from "../runtime/RequestContext.ts";

type RouteMetric = {
  requests: number;
  errors: number;
  totalDurationMs: number;
  maxDurationMs: number;
  statusCodes: Record<string, number>;
};

export type RuntimeMetricsSnapshot = {
  service: "rdl-explorer";
  startedAt: string;
  uptimeSeconds: number;
  totals: {
    requests: number;
    errors: number;
    averageDurationMs: number;
    maxDurationMs: number;
  };
  routes: Record<string, {
    requests: number;
    errors: number;
    averageDurationMs: number;
    maxDurationMs: number;
    statusCodes: Record<string, number>;
  }>;
};

export class RuntimeMetrics {
  private readonly startedAt = Date.now();
  private requests = 0;
  private errors = 0;
  private totalDurationMs = 0;
  private maxDurationMs = 0;
  private readonly routes = new Map<string, RouteMetric>();

  record(context: RequestContext, statusCode: number, now = Date.now()) {
    const durationMs = requestDurationMs(context, now);
    const error = statusCode >= 400;
    this.requests += 1;
    if (error) this.errors += 1;
    this.totalDurationMs += durationMs;
    this.maxDurationMs = Math.max(this.maxDurationMs, durationMs);

    const routeKey = `${context.method} ${context.route}`;
    const metric = this.routes.get(routeKey) ?? {
      requests: 0,
      errors: 0,
      totalDurationMs: 0,
      maxDurationMs: 0,
      statusCodes: {},
    };
    metric.requests += 1;
    if (error) metric.errors += 1;
    metric.totalDurationMs += durationMs;
    metric.maxDurationMs = Math.max(metric.maxDurationMs, durationMs);
    const statusKey = String(statusCode);
    metric.statusCodes[statusKey] = (metric.statusCodes[statusKey] ?? 0) + 1;
    this.routes.set(routeKey, metric);
  }

  snapshot(now = Date.now()): RuntimeMetricsSnapshot {
    return {
      service: "rdl-explorer",
      startedAt: new Date(this.startedAt).toISOString(),
      uptimeSeconds: Math.max(0, Math.floor((now - this.startedAt) / 1000)),
      totals: {
        requests: this.requests,
        errors: this.errors,
        averageDurationMs: average(this.totalDurationMs, this.requests),
        maxDurationMs: this.maxDurationMs,
      },
      routes: Object.fromEntries(
        [...this.routes.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([route, metric]) => [
          route,
          {
            requests: metric.requests,
            errors: metric.errors,
            averageDurationMs: average(metric.totalDurationMs, metric.requests),
            maxDurationMs: metric.maxDurationMs,
            statusCodes: { ...metric.statusCodes },
          },
        ]),
      ),
    };
  }

  reset() {
    this.requests = 0;
    this.errors = 0;
    this.totalDurationMs = 0;
    this.maxDurationMs = 0;
    this.routes.clear();
  }
}

function average(total: number, count: number) {
  return count === 0 ? 0 : Math.round((total / count) * 100) / 100;
}

const runtimeMetrics = new RuntimeMetrics();

export function getRuntimeMetrics() {
  return runtimeMetrics;
}

export function recordRequestMetric(context: RequestContext, statusCode: number) {
  runtimeMetrics.record(context, statusCode);
}
