<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="./docs/banner.jpeg" width="800" alt="Nest Logo" /></a>
</p>

# ninjadevops-otel

A small, **tracing-only** [OpenTelemetry](https://opentelemetry.io/) module for
[NestJS](https://nestjs.com/). It gives you an injectable `TraceService`, the
`@Span` / `@Traceable` / `@CurrentSpan` decorators, and a declarative
**telemetry DTO** bridge for attaching business attributes — on top of the modern
OpenTelemetry JS API (`@opentelemetry/api` 1.9+, SDK 2.x), Node.js 22+ and
NestJS 11.

It deliberately does **not** bootstrap the OpenTelemetry SDK. Following
OpenTelemetry best practices, the SDK and auto-instrumentations are started
separately (so the SDK can load before your app code), and this module simply
consumes the globally-registered `TracerProvider`.

## Features

- 🧩 **Injectable `TraceService`** — thin, typed wrapper over the OTel tracing API.
- 🎯 **`@Span` / `@Traceable`** — trace a method or a whole class with one decorator.
- 🧷 **`@CurrentSpan`** — inject the active span into a route handler.
- 📦 **Declarative telemetry DTOs** — declare business attributes once, apply them anywhere.
- ✅ **Correct async semantics** — `Promise` and `Observable` returns are handled; the span always ends, errors are recorded, success is left `UNSET`.
- 🪶 **SDK-agnostic** — bring your own `@opentelemetry/sdk-node`; this module never starts it.

## Table of contents

- [Requirements](#requirements)
- [Installation](#installation)
- [Quick start](#quick-start)
- [Concepts](#concepts)
- [Usage](#usage)
  - [`@Span`](#span--trace-a-method)
  - [`@Traceable`](#traceable--trace-every-method-of-a-class)
  - [`TraceService`](#traceservice--programmatic-access)
  - [`@CurrentSpan`](#currentspan--inject-the-active-span)
  - [Telemetry DTOs](#telemetry-dtos--declarative-business-attributes)
- [Configuration](#configuration)
- [API reference](#api-reference)
- [Documentation & examples](#documentation--examples)
- [Scripts](#scripts)
- [License](#license)

## Requirements

| Dependency           | Version       | Notes                                   |
| -------------------- | ------------- | --------------------------------------- |
| Node.js              | `>= 22`       |                                         |
| `@nestjs/common`     | `>= 11 < 12`  | peer dependency                         |
| `@nestjs/core`       | `>= 11 < 12`  | peer dependency                         |
| `rxjs`               | `^7`          | peer dependency                         |
| `@opentelemetry/api` | `^1.9`        | peer dependency (install it explicitly) |

## Installation

```bash
npm install ninjadevops-otel @opentelemetry/api
```

To actually export traces you also need the SDK in your application:

```bash
npm install @opentelemetry/sdk-node \
            @opentelemetry/auto-instrumentations-node \
            @opentelemetry/exporter-trace-otlp-proto
```

## Quick start

**1. Start the OpenTelemetry SDK** in a `tracing.ts` loaded **before** the Nest
app — as the first import in `main.ts`, or via `node --require ./dist/tracing.js`.

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

```ts
// main.ts
import './tracing'; // MUST be first
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.listen(3000);
}
bootstrap();
```

Configure the exporter via the standard env vars (`OTEL_SERVICE_NAME`,
`OTEL_EXPORTER_OTLP_ENDPOINT`, `OTEL_EXPORTER_OTLP_HEADERS`, …). Keep the default
`AlwaysOn` sampler in the SDK and do any sampling in the Collector.

**2. Register the module** in your root module:

```ts
import { Module } from '@nestjs/common';
import { OpenTelemetryModule } from 'ninjadevops-otel';

@Module({
  imports: [OpenTelemetryModule.forRoot()],
})
export class AppModule {}
```

**3. Trace something:**

```ts
import { Injectable } from '@nestjs/common';
import { Span } from 'ninjadevops-otel';

@Injectable()
export class OrdersService {
  @Span() // span "OrdersService.process"
  async process(orderId: string) {
    /* nested DB/HTTP calls attach as child spans automatically */
  }
}
```

That's it — see the [`examples/`](./examples) folder for a complete mini-app.

## Concepts

**Tracing-only & SDK-agnostic.** This module never calls `sdk.start()`. The OTel
SDK must be initialized *before* any application code runs, so trying to start it
from inside a Nest provider would be too late for auto-instrumentations. Instead
you start the SDK in a standalone `tracing.ts`, and this module reads the global
`TracerProvider` that the SDK registered. The only thing the module configures is
*which* tracer (name/version) its `TraceService` and decorators obtain.

**Two complementary questions.** The decorators answer *“which methods do I
trace?”*; the telemetry DTOs answer *“which business attributes do I attach?”*.
You can use either or both.

**Span lifecycle is handled for you.** `@Span`, `startActiveSpan` and
`startActiveSpanWith` all manage the span end and status: sync, `Promise` and
`Observable` returns are supported; on error the span is marked `ERROR` and the
exception recorded; on success the status is left `UNSET` (no speculative `OK`),
per OpenTelemetry guidance.

## Usage

### `@Span` — trace a method

```ts
import { Injectable } from '@nestjs/common';
import { SpanKind } from '@opentelemetry/api';
import { Span } from 'ninjadevops-otel';

@Injectable()
export class OrdersService {
  @Span() // span name: "OrdersService.process"
  async process(orderId: string) {
    // ... nested DB/HTTP calls attach to this span automatically
  }

  @Span('orders.checkout', { kind: SpanKind.INTERNAL }) // explicit name + options
  checkout() {}
}
```

The span is active for the duration of the call, so any nested instrumentation
becomes a child span. Sync, `Promise` and `Observable` returns are all handled
and the span always ends.

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

Pass a prefix to override the class-name prefix: `@Traceable('payments')` →
`payments.charge`. The constructor, getters and setters are skipped.

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

### `@CurrentSpan` — inject the active span

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

It resolves to `undefined` when no span is active — always guard with `?.`.

### Telemetry DTOs — declarative business attributes

Declare a DTO once and hand instances to `TraceService`, instead of building
attribute maps by hand at every call site.

```ts
import {
  AbstractTelemetryDto,
  TelemetryOperation,
  TelemetryAttribute,
} from 'ninjadevops-otel';

@TelemetryOperation('user.login') // span name + attribute `operation=user.login`
export class LoginTelemetryDto extends AbstractTelemetryDto {
  @TelemetryAttribute('app.user.id') userId!: string;
  @TelemetryAttribute('app.user.email') email?: string; // undefined/null skipped
}
```

```ts
@Injectable()
export class AuthService {
  constructor(private readonly trace: TraceService) {}

  async login(userId: string, email: string) {
    const dto = new LoginTelemetryDto();
    dto.userId = userId;
    dto.email = email;

    // (a) enrich the current span with the DTO's attributes
    this.trace.setAttributes(dto);

    // (b) or open a dedicated span — named from @TelemetryOperation —
    //     with the attributes pre-set; async/Observable handling included
    return this.trace.startActiveSpanWith(dto, () => this.doLogin(userId));
  }
}
```

Both methods also accept a raw attribute map. `startActiveSpanWith` then needs an
explicit span name (a DTO's `@TelemetryOperation` overrides it when present):

```ts
this.trace.setAttributes({ 'app.order.id': orderId });
this.trace.startActiveSpanWith({ 'app.order.id': orderId }, 'order.create', fn);
```

See [docs/telemetry-dtos.md](./docs/telemetry-dtos.md) for the full guide.

## Configuration

`OpenTelemetryModule.forRoot(options?)` and `forRootAsync(options)` accept
`OpenTelemetryModuleOptions`:

| Option          | Type     | Default            | Description                                |
| --------------- | -------- | ------------------ | ------------------------------------------ |
| `tracerName`    | `string` | `ninjadevops-otel` | Tracer name (instrumentation scope name).  |
| `tracerVersion` | `string` | `undefined`        | Tracer version (instrumentation scope ver).|

```ts
// Async configuration from ConfigService
OpenTelemetryModule.forRootAsync({
  useFactory: (config: ConfigService) => ({
    tracerName: config.get('OTEL_SERVICE_NAME'),
    tracerVersion: config.get('APP_VERSION'),
  }),
  inject: [ConfigService],
});
```

`forRootAsync` also supports `useClass` / `useExisting` with an
`OpenTelemetryOptionsFactory`.

## API reference

| Export                                        | Kind             | Description                                                        |
| --------------------------------------------- | ---------------- | ----------------------------------------------------------------- |
| `OpenTelemetryModule`                         | module           | `forRoot(options?)`, `forRootAsync(options)` (global)             |
| `TraceService`                                | injectable       | `getTracer`, `getSpan`, `startSpan`, `startActiveSpan`            |
| `TraceService.setAttributes(source)`          | method           | Applies a DTO or attribute map to the active span (no-op if none) |
| `TraceService.startActiveSpanWith(source, …)` | method           | Opens an active span pre-set with a DTO/map's attributes          |
| `@Span(name?, options?)`                      | method decorator | Wraps a method in an active span                                  |
| `@Traceable(prefix?)`                         | class decorator  | Applies `@Span` to every method                                   |
| `@CurrentSpan()`                              | param decorator  | Injects the active span (or `undefined`)                          |
| `AbstractTelemetryDto`                        | base class       | `buildSpanMap()` / `buildSpanName()` from decorated members       |
| `@TelemetryOperation(name)` / `(key, name)`   | class decorator  | Declares the span name and an operation attribute                 |
| `@TelemetryAttribute(key)`                    | prop decorator   | Maps a DTO property to a span attribute                           |

**Types:** `OpenTelemetryModuleOptions`, `OpenTelemetryModuleAsyncOptions`,
`OpenTelemetryOptionsFactory`, `TelemetryDto`, `TelemetryAttributes`,
`TelemetrySource`, plus the helpers `isTelemetryDto`, `toTelemetryAttributes`,
`resolveSpanName`.

Full signatures: [docs/api.md](./docs/api.md).

## Documentation & examples

- [docs/getting-started.md](./docs/getting-started.md) — end-to-end setup.
- [docs/api.md](./docs/api.md) — full API reference with signatures.
- [docs/telemetry-dtos.md](./docs/telemetry-dtos.md) — the DTO bridge in depth.
- [docs/best-practices.md](./docs/best-practices.md) — naming, attributes, sampling, testing.
- [docs/migration.md](./docs/migration.md) — migrating from `@ninjadevops/otel-nestjs`.
- [examples/](./examples) — a runnable NestJS mini-app.

## Scripts

```bash
npm run build      # tsc -> dist
npm test           # jest
npm run test:cov   # coverage
npm run lint       # biome check
npm run format     # biome check --write
```

## Author

Created and maintained by **[Seba Pinery](https://sebapinery.sitereliabilityengineer.ing/)**.

## License

[Apache-2.0](./LICENSE) © Seba Pinery.
