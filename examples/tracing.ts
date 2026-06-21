/**
 * OpenTelemetry SDK bootstrap.
 *
 * This file MUST be loaded before any application code so that
 * auto-instrumentations can patch libraries as they are imported. Load it as the
 * first import in `main.ts`, or preload it with `node --require ./dist/tracing.js`.
 *
 * `ninjadevops-otel` itself never starts the SDK — it only consumes the global
 * TracerProvider this file registers.
 */
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto';
import { NodeSDK } from '@opentelemetry/sdk-node';

const sdk = new NodeSDK({
  // Endpoint, headers and service name come from OTEL_* env vars.
  traceExporter: new OTLPTraceExporter(),
  instrumentations: [getNodeAutoInstrumentations()],
});

sdk.start();

// Flush spans on shutdown so the last batch is not lost.
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, () => {
    sdk.shutdown().finally(() => process.exit(0));
  });
}
