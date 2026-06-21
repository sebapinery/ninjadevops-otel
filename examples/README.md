# Examples

A small NestJS app showing every part of `ninjadevops-otel` working together.
These files are **illustrative** — they import the package by its published name
(`ninjadevops-otel`) and are not part of the library build (`tsconfig` only
compiles `src/`). Copy them into an app to run.

## Files

| File                                                       | Shows                                              |
| ---------------------------------------------------------- | -------------------------------------------------- |
| [`tracing.ts`](./tracing.ts)                               | SDK bootstrap — must load first                    |
| [`main.ts`](./main.ts)                                     | Importing `tracing` before the app                 |
| [`app.module.ts`](./app.module.ts)                         | Registering `OpenTelemetryModule`                  |
| [`orders/orders.service.ts`](./orders/orders.service.ts)   | `@Span`, `@Traceable`, `TraceService.setAttributes`|
| [`orders/orders.controller.ts`](./orders/orders.controller.ts) | A traced HTTP handler                          |
| [`auth/login.telemetry-dto.ts`](./auth/login.telemetry-dto.ts) | Declaring a telemetry DTO                       |
| [`auth/auth.service.ts`](./auth/auth.service.ts)           | Consuming a DTO with `startActiveSpanWith`         |
| [`health/health.controller.ts`](./health/health.controller.ts) | `@CurrentSpan`                                  |

## Run it

```bash
# from an app that has ninjadevops-otel + the OTel SDK installed
OTEL_SERVICE_NAME=demo \
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318 \
node --require ./dist/tracing.js dist/main.js
```

Then call `GET /orders/42` or `POST /auth/login` and inspect the trace in your
backend (or a local Collector). See [../docs/getting-started.md](../docs/getting-started.md).
