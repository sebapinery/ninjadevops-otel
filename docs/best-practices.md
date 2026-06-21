# Best practices

## Span naming

- Let `@Span()` default to `ClassName.method` for internal work — it's stable and
  greppable.
- Use **low-cardinality** names. Name spans after the *operation*
  (`order.create`), never after the data (`order.create.12345`). Put the id in an
  attribute instead.
- Reserve explicit names for cross-cutting operations that span classes
  (`payments.charge`).

## Attributes

- Follow the [OpenTelemetry semantic conventions](https://opentelemetry.io/docs/specs/semconv/)
  for anything standard (`http.*`, `db.*`, `messaging.*`). Auto-instrumentations
  already emit these — don't duplicate them.
- Prefix your own attributes with a namespace (`app.*`) so they never collide
  with conventions.
- Attribute **values** can be high-cardinality (ids, emails); attribute **keys**
  and span **names** must be low-cardinality.
- Don't put secrets (tokens, passwords, full card numbers) in attributes — spans
  are often retained and broadly readable. Redact in the Collector if needed.
- Prefer typed values: pass numbers/booleans as-is rather than stringifying, so
  backends can aggregate on them. `AbstractTelemetryDto` preserves primitive
  types for you.

## Span lifecycle

- Prefer `@Span` / `startActiveSpan` / `startActiveSpanWith` over manual
  `startSpan` — they end the span and set error status for you, including for
  `Promise` and `Observable` returns.
- Only reach for `startSpan` when you intentionally manage the span across
  callbacks; then you **must** call `span.end()` (ideally in a `finally`).
- Don't set status `OK` on success — leave it `UNSET`, per OTel guidance. The
  library already does this.

## SDK & sampling

- Start the SDK in a standalone `tracing.ts` loaded first; never start it from a
  Nest provider (too late for auto-instrumentation).
- Keep the SDK sampler at `AlwaysOn` and sample in the Collector
  (`tail_sampling` / `probabilistic_sampler`) so the decision is centralized and
  can consider the whole trace.
- Always flush on shutdown (`sdk.shutdown()` on `SIGTERM`/`SIGINT`) or you lose
  the last batch of spans.

## DTOs vs. ad-hoc attributes

- Reusable, named operations with a known attribute shape → a `AbstractTelemetryDto`.
- A handful of one-off attributes → `setAttributes({ ... })`.
- Use `setAttributes` to enrich an existing span; `startActiveSpanWith` when the
  operation deserves its own span.

## Testing

DTOs are plain objects — assert on `buildSpanMap()` / `buildSpanName()` with no
SDK. To assert real spans, drive the SDK with an in-memory exporter:

```ts
import { context, trace, SpanStatusCode } from '@opentelemetry/api';
import { AsyncLocalStorageContextManager } from '@opentelemetry/context-async-hooks';
import {
  BasicTracerProvider,
  InMemorySpanExporter,
  SimpleSpanProcessor,
} from '@opentelemetry/sdk-trace-base';

const exporter = new InMemorySpanExporter();

beforeAll(() => {
  const provider = new BasicTracerProvider({
    spanProcessors: [new SimpleSpanProcessor(exporter)],
  });
  trace.setGlobalTracerProvider(provider);
  context.setGlobalContextManager(new AsyncLocalStorageContextManager().enable());
});

afterEach(() => exporter.reset());

it('emits a span with attributes', async () => {
  const trace$ = new TraceService({ tracerName: 'test' });
  await trace$.startActiveSpanWith({ 'app.order.id': 'o-1' }, 'order.create', async () => {});

  const span = exporter.getFinishedSpans()[0];
  expect(span.name).toBe('order.create');
  expect(span.attributes['app.order.id']).toBe('o-1');
  expect(span.status.code).toBe(SpanStatusCode.UNSET);
});
```

> Setting a global context manager is what makes `startActiveSpan` propagate the
> active span; without it, `getSpan()` inside a callback returns `undefined`.

See the package's own `src/**/*.spec.ts` for complete, working examples.
