/**
 * Application Performance Monitoring
 * Purpose: Track performance metrics, API response times, database queries
 */

interface MetricData {
  name: string;
  value: number;
  tags?: Record<string, string>;
  timestamp?: number;
}

interface TimingMetric {
  startTime: number;
  name: string;
  tags?: Record<string, string>;
}

class MetricsCollector {
  private metrics: MetricData[] = [];
  private timings: Map<string, TimingMetric> = new Map();
  private flushInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Auto-flush metrics every 10 seconds
    if (typeof window === 'undefined') {
      this.flushInterval = setInterval(() => this.flush(), 10000);
    }
  }

  /**
   * Track a numeric metric (counter, gauge)
   */
  track(name: string, value: number, tags?: Record<string, string>) {
    this.metrics.push({
      name,
      value,
      tags,
      timestamp: Date.now(),
    });

    // Send to console in development
    if (process.env.NODE_ENV === 'development') {
    }
  }

  /**
   * Increment a counter
   */
  increment(name: string, tags?: Record<string, string>) {
    this.track(name, 1, tags);
  }

  /**
   * Start timing an operation
   */
  startTiming(name: string, tags?: Record<string, string>): string {
    const timingId = `${name}_${Date.now()}_${Math.random()}`;
    this.timings.set(timingId, {
      startTime: Date.now(),
      name,
      tags,
    });
    return timingId;
  }

  /**
   * End timing and record duration
   */
  endTiming(timingId: string) {
    const timing = this.timings.get(timingId);
    if (!timing) return;

    const duration = Date.now() - timing.startTime;
    this.track(`${timing.name}.duration_ms`, duration, timing.tags);
    this.timings.delete(timingId);

    return duration;
  }

  /**
   * Track API response time
   */
  trackAPICall(endpoint: string, method: string, statusCode: number, duration: number) {
    this.track('api.response_time', duration, {
      endpoint,
      method,
      status: String(statusCode),
    });

    this.increment('api.request_count', {
      endpoint,
      method,
      status: String(statusCode),
    });

    // Track errors separately
    if (statusCode >= 400) {
      this.increment('api.error_count', {
        endpoint,
        method,
        status: String(statusCode),
      });
    }
  }

  /**
   * Track database query performance
   */
  trackDatabaseQuery(table: string, operation: string, duration: number, recordCount?: number) {
    this.track('database.query_time', duration, {
      table,
      operation,
    });

    if (recordCount !== undefined) {
      this.track('database.records_processed', recordCount, {
        table,
        operation,
      });
    }
  }

  /**
   * Track business metrics
   */
  trackBusinessMetric(name: string, value: number, tags?: Record<string, string>) {
    this.track(`business.${name}`, value, tags);
  }

  /**
   * Flush metrics to external service (Datadog, New Relic, etc.)
   */
  private async flush() {
    if (this.metrics.length === 0) return;

    const metricsToSend = [...this.metrics];
    this.metrics = [];

    // Send to external monitoring service
    if (process.env.DATADOG_API_KEY) {
      await this.sendToDatadog(metricsToSend);
    }

    // Send to custom analytics endpoint
    if (process.env.NEXT_PUBLIC_ANALYTICS_ENDPOINT) {
      await this.sendToAnalytics(metricsToSend);
    }
  }

  private async sendToDatadog(metrics: MetricData[]) {
    try {
      const series = metrics.map((metric) => ({
        metric: metric.name,
        points: [[Math.floor(metric.timestamp! / 1000), metric.value]],
        type: 'count',
        tags: metric.tags ? Object.entries(metric.tags).map(([k, v]) => `${k}:${v}`) : [],
      }));

      await fetch('https://api.datadoghq.com/api/v1/series', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'DD-API-KEY': process.env.DATADOG_API_KEY!,
        },
        body: JSON.stringify({ series }),
      });
    } catch (error) {
      console.error('Failed to send metrics to Datadog:', error);
    }
  }

  private async sendToAnalytics(metrics: MetricData[]) {
    try {
      await fetch(process.env.NEXT_PUBLIC_ANALYTICS_ENDPOINT!, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ metrics }),
      });
    } catch (error) {
      console.error('Failed to send metrics to analytics:', error);
    }
  }

  /**
   * Cleanup on shutdown
   */
  destroy() {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }
    this.flush();
  }
}

// Singleton instance
export const metrics = new MetricsCollector();

// Convenience functions
export function trackMetric(name: string, value: number, tags?: Record<string, string>) {
  metrics.track(name, value, tags);
}

export function incrementCounter(name: string, tags?: Record<string, string>) {
  metrics.increment(name, tags);
}

export function trackAPICall(endpoint: string, method: string, statusCode: number, duration: number) {
  metrics.trackAPICall(endpoint, method, statusCode, duration);
}

export function trackDatabaseQuery(table: string, operation: string, duration: number, recordCount?: number) {
  metrics.trackDatabaseQuery(table, operation, duration, recordCount);
}

export function trackBusinessMetric(name: string, value: number, tags?: Record<string, string>) {
  metrics.trackBusinessMetric(name, value, tags);
}

// Timing helper
export async function trackTiming<T>(
  name: string,
  fn: () => Promise<T>,
  tags?: Record<string, string>
): Promise<T> {
  const timingId = metrics.startTiming(name, tags);
  try {
    const result = await fn();
    metrics.endTiming(timingId);
    return result;
  } catch (error) {
    metrics.endTiming(timingId);
    throw error;
  }
}
