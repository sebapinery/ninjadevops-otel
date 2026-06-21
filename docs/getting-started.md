# Getting started

This guide takes a fresh NestJS app from zero to exported traces.

## 1. Install

```bash
npm install ninjadevops-otel @opentelemetry/api
npm install @opentelemetry/sdk-node \
            @opentelemetry/auto-instrumentations-node \
            @opentelemetry/exporter-trace-otlp-proto
```

`ninjadevops-otel` is tracing-only and does **not** ship the SDK — you own the
SDK setup so it can load before your application code.

## 2. Bootstrap the SDK (`tracing.ts`)

The SDK must start **before** any instrumented library is imported, otherwise
auto-instrumentations cannot patch them. Put it in its own file and import it
first.

```ts
// src/tracing.ts
import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';

const sdk = new NodeSDK({
  traceExporter: new OTLPTraceExporter(), // reads OTEL_EXPORTER_OTLP_* env vars
  instrumentations: [getNodeAutoInstrumentations()],
});

sdk.start();

// Flush on shutdown so the last spans are not lost.
process.on('SIGTERM', () => {
  sdk.shutdown().finally(() => process.exit(0));
});
```

Two ways to make sure it loads first:

```ts
// Option A — first import in main.ts
import './tracing';
```

```bash
# Option B — preload, no source change
node --require ./dist/tracing.js dist/main.js
```

## 3. Configure via environment

The OTLP exporter and resource read standard env vars — no code needed:

```bash
OTEL_SERVICE_NAME=orders-api
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
OTEL_EXPORTER_OTLP_HEADERS="authorization=Bearer <token>"
OTEL_RESOURCE_ATTRIBUTES="deployment.environment=staging,service.version=1.4.0"
```

Keep the SDK sampler at the default `AlwaysOn` and do sampling in the Collector,
so sampling decisions stay centralized.

## 4. Register the module

```ts
// src/app.module.ts
import { Module } from '@nestjs/common';
import { OpenTelemetryModule } from 'ninjadevops-otel';

@Module({
  imports: [OpenTelemetryModule.forRoot()],
})
export class AppModule {}
```

`OpenTelemetryModule` is `@Global()`, so a single `forRoot()` in the root module
makes `TraceService` injectable everywhere — no re-imports per feature module.

Need configuration from `ConfigService`? Use `forRootAsync`:

```ts
OpenTelemetryModule.forRootAsync({
  useFactory: (config: ConfigService) => ({
    tracerName: config.get('OTEL_SERVICE_NAME'),
    tracerVersion: config.get('APP_VERSION'),
  }),
  inject: [ConfigService],
});
```

## 5. Trace your code

```ts
import { Injectable } from '@nestjs/common';
import { Span, TraceService } from 'ninjadevops-otel';

@Injectable()
export class OrdersService {
  constructor(private readonly trace: TraceService) {}

  @Span() // span "OrdersService.checkout"
  async checkout(orderId: string) {
    this.trace.setAttributes({ 'app.order.id': orderId });
    // DB / HTTP work here becomes child spans
  }
}
```

## 6. Verify

Point the exporter at a local Collector or directly at your backend, hit an
endpoint, and confirm the span shows up. A quick local Collector:

```bash
docker run --rm -p 4318:4318 otel/opentelemetry-collector --config=/etc/otelcol/config.yaml
```

## Troubleshooting

- **No spans at all** — the SDK didn't start first. Ensure `tracing.ts` is the
  very first import (or `--require`d) and that `sdk.start()` runs.
- **Spans truncated on exit** — call `sdk.shutdown()` on `SIGTERM`/`SIGINT`.
- **`TraceService` not found** — `OpenTelemetryModule.forRoot()` is missing from
  the root module.
- **Decorated method not traced** — `experimentalDecorators` and
  `emitDecoratorMetadata` must be enabled in your `tsconfig.json`.

Next: [telemetry-dtos.md](./telemetry-dtos.md) · [best-practices.md](./best-practices.md)
