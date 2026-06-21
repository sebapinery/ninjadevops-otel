# Migrating from `@ninjadevops/otel-nestjs`

`ninjadevops-otel` is the successor to the older `@ninjadevops/otel-nestjs`
package. It keeps the declarative-DTO idea but rebuilds it on a modern, correct
tracing core (OTel SDK 2.x, proper `Promise`/`Observable` handling, real DI).
This guide maps the old API to the new one.

## Why migrate

| Concern                          | `@ninjadevops/otel-nestjs` | `ninjadevops-otel`                    |
| -------------------------------- | -------------------------- | ------------------------------------- |
| Async spans (Promise/Observable) | span closed synchronously  | fully handled, span ends correctly    |
| Error status on spans            | not recorded               | `recordException` + `ERROR`           |
| Dependency injection             | `new` inside the service   | real DI, `forRootAsync`               |
| Method tracing decorators        | —                          | `@Span`, `@Traceable`, `@CurrentSpan` |
| API naming                       | `...ToAgend...` typo       | clean                                 |

## Module

```diff
- import { TelemetryModule } from '@ninjadevops/otel-nestjs';
+ import { OpenTelemetryModule } from 'ninjadevops-otel';

  @Module({
-   imports: [TelemetryModule.forRoot()],
+   imports: [OpenTelemetryModule.forRoot()],
  })
  export class AppModule {}
```

`OpenTelemetryModule` is still `@Global()`, and now also offers `forRootAsync`.

## Service injection

```diff
- import { TelemetryService } from '@ninjadevops/otel-nestjs';
+ import { TraceService } from 'ninjadevops-otel';

- constructor(private readonly telemetry: TelemetryService) {}
+ constructor(private readonly trace: TraceService) {}
```

## DTOs

```diff
  import {
-   AbstractBaseTelemetryDto,
+   AbstractTelemetryDto,
    TelemetryOperation,
    TelemetryAttribute,
- } from '@ninjadevops/otel-nestjs';
+ } from 'ninjadevops-otel';

- @TelemetryOperation('operation', 'user.login')
+ @TelemetryOperation('user.login')          // 'operation' key is now the default
- export class LoginTelemetryDto extends AbstractBaseTelemetryDto {
+ export class LoginTelemetryDto extends AbstractTelemetryDto {
    @TelemetryAttribute('userId') userId!: string;
  }
```

The two-argument form still works if you need a custom attribute key:
`@TelemetryOperation('app.operation', 'user.login')`.

## Method calls

| Old (`TelemetryService`)                          | New (`TraceService`)                              |
| ------------------------------------------------- | ------------------------------------------------- |
| `sendTelemetry(dto)`                              | `setAttributes(dto)`                              |
| `sendTelemetry(map)`                              | `setAttributes(map)`                              |
| `sendTelemetryNewSpan(dto, name, kind)`           | `startActiveSpanWith(dto, fn, { kind })`          |
| `sendTelemetryNewSpan(map, name, kind)`           | `startActiveSpanWith(map, name, fn, { kind })`    |
| `sendTelemetryToAgendInCurrentSpan(map)`          | `setAttributes(map)`                              |
| `sendTelemetryToAgendInNewSpan(map, name, kind?)` | `startActiveSpanWith(map, name, fn, { kind })`    |

### The key behavioral change

The old `sendTelemetryNewSpan` opened a span, set attributes, and **closed it
immediately** — it never wrapped your work. The new `startActiveSpanWith` takes a
callback and keeps the span active for its whole duration, so nested work becomes
child spans and the span ends only when the work finishes.

```diff
- this.telemetry.sendTelemetryNewSpan(dto, 'user.login', SpanKind.SERVER);
- await this.doLogin(userId); // ran OUTSIDE the span

+ await this.trace.startActiveSpanWith(
+   dto,
+   () => this.doLogin(userId),         // runs INSIDE the span
+   { kind: SpanKind.SERVER },
+ );
```

## Interceptor

The old `TelemetryInterceptor` (auto-span per `@TelemetryOperation` handler) has
no drop-in equivalent yet. Replace it with `@Span` on the handler, which gives a
correctly-scoped server span:

```diff
- @Get(':id')
- @TelemetryOperation('operation', 'user.getById')
- getUser() {}

+ @Get(':id')
+ @Span('user.getById', { kind: SpanKind.SERVER })
+ getUser() {}
```

## Testing

`TelemetryTestingModule` / `NoOpTelemetryService` are gone. They aren't needed:
without a registered SDK, `TraceService` and the decorators are effectively
no-ops (`getActiveSpan()` returns `undefined`), so unit tests run without any
telemetry setup. To assert spans, register an `InMemorySpanExporter` — see
[best-practices.md](./best-practices.md#testing).

## Error handling

The old service swallowed every error in an empty `catch {}`. The new core does
**not** hide configuration mistakes (e.g. `startActiveSpanWith` with no resolvable
name throws). Tracing of *business* calls still never breaks your flow: a missing
SDK simply means no spans, not an exception.
