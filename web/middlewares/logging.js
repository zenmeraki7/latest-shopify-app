import { randomUUID } from "crypto";
import promClient from "prom-client";

/* ============================================================================
   📊 Prometheus Metrics
   ========================================================================== */

const requestDuration = new promClient.Histogram({
  name: "admin_request_duration_ms",
  help: "Duration of admin API requests in milliseconds",
  labelNames: ["method", "route", "status"],
  buckets: [50, 100, 200, 500, 1000, 2000, 5000], // latency buckets
});

const errorCounter = new promClient.Counter({
  name: "admin_request_errors_total",
  help: "Count of admin API errors",
  labelNames: ["method", "route", "status"],
});

// Collect default process metrics (CPU, memory, etc.)
promClient.collectDefaultMetrics();

/* ============================================================================
   ⚡ Performance Logger Middleware
   ========================================================================== */

/**
 * Tracks duration and logs per-request performance for admin endpoints.
 * Adds `req.requestId` for correlation across distributed logs.
 */
export function performanceLogger(req, res, next) {
  const start = Date.now();
  req.requestId = randomUUID();

  const { method, originalUrl, ip } = req;
  const route = originalUrl.split("?")[0];
  console.info(`🟢 [ADMIN] → ${method} ${route} [${req.requestId}] from ${ip}`);

  // Wrap res.send to measure duration and record metrics
  const originalSend = res.send;
  res.send = function (body) {
    const duration = Date.now() - start;
    const status = res.statusCode;
    const color =
      status >= 500
        ? "\x1b[31m❌"
        : status >= 400
        ? "\x1b[33m⚠️"
        : "\x1b[32m✅";

    console.info(
      `${color} [ADMIN] ${method} ${route} - ${status} - ${duration}ms [${req.requestId}]\x1b[0m`
    );

    if (duration > 1000) {
      console.warn(`🐢 [ADMIN] SLOW REQUEST: ${method} ${route} took ${duration}ms`);
    }

    if (process.env.ENABLE_METRICS === "true") {
      try {
        requestDuration.observe({ method, route, status }, duration);
      } catch (err) {
        console.error("⚠️ Failed to record Prometheus metric:", err.message);
      }
    }

    return originalSend.call(this, body);
  };

  next();
}

/* ============================================================================
   💥 Error Logger Middleware
   ========================================================================== */

export function errorLogger(err, req, res, next) {
  const { method, originalUrl, ip, requestId } = req;
  const route = originalUrl?.split("?")[0] || "unknown";
  const status = err.status || 500;

  console.error(
    `\x1b[31m💥 [ADMIN] ERROR ${status}: ${method} ${route} [${requestId}] from ${ip}\x1b[0m`
  );
  console.error({
    message: err.message,
    stack: err.stack,
    timestamp: new Date().toISOString(),
  });

  if (process.env.ENABLE_METRICS === "true") {
    try {
      errorCounter.inc({ method, route, status });
    } catch (metricErr) {
      console.error("⚠️ Failed to increment error metric:", metricErr.message);
    }
  }

  res.status(status).json({
    error:
      status === 500
        ? "Internal server error"
        : err.message || "Unexpected error",
    requestId: requestId || "unknown",
  });
}

/* ============================================================================
   🧠 Optional Prometheus Metrics Endpoint
   ========================================================================== */

/**
 * Exposes `/metrics` endpoint for Prometheus scraping.
 * Secure by default: only active when ENABLE_METRICS=true.
 */
export async function metricsHandler(req, res) {
  if (process.env.ENABLE_METRICS !== "true") {
    return res.status(404).json({ error: "Metrics disabled" });
  }

  try {
    res.set("Content-Type", promClient.register.contentType);
    res.end(await promClient.register.metrics());
  } catch (err) {
    console.error("❌ Metrics export failed:", err);
    res.status(500).json({ error: "Failed to export metrics" });
  }
}
export { requestDuration };
