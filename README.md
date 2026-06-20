<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo_text.svg" width="320" alt="Nest Logo" /></a>
</p>

# ninjadevops-otel

A small, **tracing-only** [OpenTelemetry](https://opentelemetry.io/) module for
[NestJS](https://nestjs.com/). It gives you an injectable `TraceService` and the
`@Span` / `@Traceable` decorators, on top of the modern OpenTelemetry JS API
(`@opentelemetry/api` 1.9+, SDK 2.x), Node.js 22+ and NestJS 11.

It deliberately does **not** bootstrap the OpenTelemetry SDK. Following
OpenTelemetry best practices, the SDK and auto-instrumentations are started
separately (so the SDK can load before your app code), and this module simply
consumes the globally-registered `TracerProvider`.

## Installation

```bash
npm install ninjadevops-otel @opentelemetry/api
```

Peer dependencies: `@nestjs/common`, `@nestjs/core` (>=11 <12), `rxjs` (^7).

To actually export traces you also need the SDK (dev/runtime of your app):

```bash
npm install @opentelemetry/sdk-node @opentelemetry/auto-instrumentations-node @opentelemetry/exporter-trace-otlp-proto
```

## 1. Start the OpenTelemetry SDK

Create `tracing.ts` and load it **before** the Nest app — e.g. as the first
import in `main.ts`, or via `node --require ./dist/tracing.js`.

```ts
// tracing.ts
import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';

const sdk = new NodeSDK({
  traceExporter: new OTLPTraceExporter(),
  instrumentations: [getNodeAutoInstrumentations()],
});

sdk.start();
```

Configure the exporter via the standard env vars (`OTEL_SERVICE_NAME`,
`OTEL_EXPORTER_OTLP_ENDPOINT`, `OTEL_EXPORTER_OTLP_HEADERS`, …). Keep the default
`AlwaysOn` sampler in the SDK and do any sampling in the Collector.

## 2. Register the module

```ts
import { Module } from '@nestjs/common';
import { OpenTelemetryModule } from 'ninjadevops-otel';

@Module({
  imports: [OpenTelemetryModule.forRoot()],
})
export class AppModule {}
```

Or asynchronously:

```ts
OpenTelemetryModule.forRootAsync({
  useFactory: (config: ConfigService) => ({
    tracerName: config.get('OTEL_SERVICE_NAME'),
    tracerVersion: config.get('APP_VERSION'),
  }),
  inject: [ConfigService],
});
```

## Usage

### `@Span` — trace a method

```ts
import { Injectable } from '@nestjs/common';
import { Span } from 'ninjadevops-otel';

@Injectable()
export class OrdersService {
  @Span() // span name: "OrdersService.process"
  async process(orderId: string) {
    // ... nested DB/HTTP calls attach to this span automatically
  }

  @Span('orders.checkout') // explicit name
  checkout() {}
}
```

The span is active for the duration of the call, so any nested instrumentation
becomes a child span. Sync, `Promise` and `Observable` returns are all handled
and the span always ends. On a thrown error the span is marked `ERROR` and the
exception is recorded; on success the status is left `UNSET` (no speculative
`OK`).

### `@Traceable` — trace every method of a class

```ts
import { Injectable } from '@nestjs/common';
import { Traceable } from 'ninjadevops-otel';

@Injectable()
@Traceable() // spans: "PaymentService.<method>"
export class PaymentService {
  charge() {}
  refund() {}
}
```

### `TraceService` — programmatic access

```ts
import { Injectable } from '@nestjs/common';
import { TraceService } from 'ninjadevops-otel';

@Injectable()
export class ReportService {
  constructor(private readonly trace: TraceService) {}

  build() {
    return this.trace.startActiveSpan('report.build', (span) => {
      span.setAttribute('report.kind', 'daily');
      return this.compute();
    });
  }

  enrich() {
    this.trace.getSpan()?.setAttribute('app.enriched', true);
  }
}
```

### `@CurrentSpan` — inject the active span into a handler

```ts
import { Controller, Get } from '@nestjs/common';
import { Span } from '@opentelemetry/api';
import { CurrentSpan } from 'ninjadevops-otel';

@Controller('health')
export class HealthController {
  @Get()
  check(@CurrentSpan() span?: Span) {
    span?.setAttribute('app.handler', 'health.check');
    return { ok: true };
  }
}
```

## API

| Export                    | Kind             | Description                                            |
| ------------------------- | ---------------- | ------------------------------------------------------ |
| `OpenTelemetryModule`     | module           | `forRoot(options?)`, `forRootAsync(options)` (global)  |
| `TraceService`            | injectable       | `getTracer`, `getSpan`, `startSpan`, `startActiveSpan` |
| `@Span(name?, options?)`  | method decorator | Wraps a method in an active span                       |
| `@Traceable(prefix?)`     | class decorator  | Applies `@Span` to every method                        |
| `@CurrentSpan()`          | param decorator  | Injects the active span (or `undefined`)               |

`OpenTelemetryModuleOptions`: `{ tracerName?: string; tracerVersion?: string }`.

## Scripts

```bash
npm run build      # tsc -> dist
npm test           # jest
npm run test:cov   # coverage
npm run lint       # biome check
npm run format     # biome check --write
```

## License

UNLICENSED — private package owned by ninjadevops.
