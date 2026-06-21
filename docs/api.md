# API reference

All exports are available from the package root:

```ts
import {
  OpenTelemetryModule,
  TraceService,
  Span,
  Traceable,
  CurrentSpan,
  AbstractTelemetryDto,
  TelemetryOperation,
  TelemetryAttribute,
} from 'ninjadevops-otel';
```

## `OpenTelemetryModule`

Global module that provides `TraceService`. It does **not** start the OTel SDK.

```ts
static forRoot(options?: OpenTelemetryModuleOptions): DynamicModule
static forRootAsync(options: OpenTelemetryModuleAsyncOptions): DynamicModule
```

- `forRoot(options?)` — synchronous registration.
- `forRootAsync(options)` — resolve options via `useFactory`, `useClass` or
  `useExisting` (an `OpenTelemetryOptionsFactory`).

### `OpenTelemetryModuleOptions`

```ts
interface OpenTelemetryModuleOptions {
  tracerName?: string;    // default: 'ninjadevops-otel'
  tracerVersion?: string; // instrumentation scope version
}
```

## `TraceService`

Injectable wrapper around the OpenTelemetry tracing API. Resolves a `Tracer`
from the global `TracerProvider`.

```ts
getTracer(): Tracer
```
The tracer backing this service.

```ts
getSpan(): Span | undefined
```
The currently active span, or `undefined` when none is in context.

```ts
startSpan(name: string, options?: SpanOptions, context?: Context): Span
```
Start a span **without** making it active. You own its lifecycle and must call
`span.end()` yourself.

```ts
startActiveSpan<T>(name: string, fn: (span: Span) => T, options?: SpanOptions): T
```
Start a span, make it active for the duration of `fn`, and end it automatically.
Handles sync, `Promise` and `Observable` returns. On a thrown/rejected error the
span is marked `ERROR` and the exception recorded; on success the status is left
`UNSET`.

```ts
setAttributes(source: TelemetrySource): void
```
Apply a `TelemetryDto` or a raw attribute map to the **active** span. No-op when
no span is active, so it is always safe to call.

```ts
startActiveSpanWith<T>(source: TelemetrySource, fn: (span: Span) => T, options?: SpanOptions): T
startActiveSpanWith<T>(source: TelemetrySource, name: string, fn: (span: Span) => T, options?: SpanOptions): T
```
Open an active span pre-populated with `source`'s attributes and run `fn` inside
it — same async handling and error semantics as `startActiveSpan`. The span name
comes from the DTO's `@TelemetryOperation` when present, otherwise from the
explicit `name`. Passing neither throws.

## Decorators

### `@Span(name?, options?)`

Method decorator. Wraps the method in an active span.

- `name` — span name; defaults to `ClassName.methodName`.
- `options` — standard OpenTelemetry `SpanOptions` (`kind`, `attributes`, …).

Sync, `Promise` and `Observable` returns are handled; NestJS route metadata on
the method (guards, pipes, param decorators) is preserved.

### `@Traceable(prefix?)`

Class decorator. Applies `@Span` to every method of the class.

- `prefix` — span-name prefix; defaults to the class name. Spans are named
  `prefix.methodName`. The constructor, getters and setters are skipped.

### `@CurrentSpan()`

Parameter decorator (built on `createParamDecorator`). Injects the currently
active `Span`, or `undefined` when none is active.

## Telemetry DTOs

### `AbstractTelemetryDto`

Base class implementing `TelemetryDto`.

```ts
buildSpanMap(): TelemetryAttributes
```
Builds the attribute map from `@TelemetryAttribute` properties (and the
`@TelemetryOperation` attribute). `undefined`/`null` properties are skipped;
primitives pass through, arrays are stringified element-wise, other objects are
stringified.

```ts
buildSpanName(): string | undefined
```
The operation name declared via `@TelemetryOperation`, or `undefined`.

### `@TelemetryOperation(name)` / `@TelemetryOperation(attributeKey, name)`

Class decorator. Declares the operation a DTO represents.

- `@TelemetryOperation(name)` — records attribute `operation=<name>` and uses
  `name` as the span name.
- `@TelemetryOperation(attributeKey, name)` — records `attributeKey=<name>`
  instead of the default `operation` key.

### `@TelemetryAttribute(attributeKey)`

Property decorator. Maps a DTO property to a span attribute key. The property's
runtime value becomes the attribute value.

## Types & helpers

```ts
type TelemetryAttributes = Record<string, AttributeValue | undefined>;
type TelemetrySource = TelemetryDto | TelemetryAttributes;

interface TelemetryDto {
  buildSpanMap(): TelemetryAttributes;
  buildSpanName(): string | undefined;
}

interface OpenTelemetryOptionsFactory {
  createOpenTelemetryOptions(): OpenTelemetryModuleOptions | Promise<OpenTelemetryModuleOptions>;
}

function isTelemetryDto(source: TelemetrySource): source is TelemetryDto;
function toTelemetryAttributes(source: TelemetrySource): Attributes;
function resolveSpanName(source: TelemetrySource): string | undefined;
```

`toTelemetryAttributes` resolves a source to an OTel `Attributes` map, dropping
`undefined` values; `resolveSpanName` returns a DTO's span name (raw maps return
`undefined`).
