# Telemetry DTOs

The decorators (`@Span`, `@Traceable`) define **which methods are traced**. The
telemetry DTO bridge defines **which business attributes are attached** to those
spans — declaratively, in one place, instead of hand-building attribute maps at
every call site.

## The pieces

| Piece                   | Role                                                     |
| ----------------------- | -------------------------------------------------------- |
| `AbstractTelemetryDto`  | Base class; turns a decorated object into an attr map.   |
| `@TelemetryOperation`   | Class decorator; sets the span name + an `operation` attr|
| `@TelemetryAttribute`   | Property decorator; maps a property to an attribute key. |
| `TraceService.setAttributes` | Applies a DTO/map to the **active** span.           |
| `TraceService.startActiveSpanWith` | Opens a **new** span pre-set with a DTO/map.  |

## Defining a DTO

```ts
import {
  AbstractTelemetryDto,
  TelemetryOperation,
  TelemetryAttribute,
} from 'ninjadevops-otel';

@TelemetryOperation('user.login')
export class LoginTelemetryDto extends AbstractTelemetryDto {
  @TelemetryAttribute('app.user.id') userId!: string;
  @TelemetryAttribute('app.user.email') email?: string;
  @TelemetryAttribute('app.user.attempts') attempts!: number;
}
```

A populated instance builds this map:

```ts
const dto = new LoginTelemetryDto();
dto.userId = 'u-42';
dto.attempts = 1;
// email left undefined

dto.buildSpanMap();
// => { operation: 'user.login', 'app.user.id': 'u-42', 'app.user.attempts': 1 }
dto.buildSpanName();
// => 'user.login'
```

Notes:

- The `@TelemetryOperation` value is **both** the span name and an `operation`
  attribute.
- `undefined`/`null` properties are **skipped** (no `"undefined"` strings).
- Primitive values (`string`/`number`/`boolean`) keep their type; arrays are
  stringified element-wise; other objects are stringified via `String()`.

### Custom operation attribute key

```ts
@TelemetryOperation('app.operation', 'order.create')
export class CreateOrderDto extends AbstractTelemetryDto {}
// buildSpanMap() => { 'app.operation': 'order.create' }
// buildSpanName() => 'order.create'
```

## Consuming a DTO

### (a) Enrich the current span

Use when something upstream already opened a span (an HTTP server span, a
`@Span` method) and you just want to add attributes:

```ts
@Injectable()
export class AuthService {
  constructor(private readonly trace: TraceService) {}

  @Span() // opens "AuthService.login"
  async login(userId: string, email: string) {
    const dto = new LoginTelemetryDto();
    dto.userId = userId;
    dto.email = email;

    this.trace.setAttributes(dto); // attaches to the @Span span
    return this.doLogin(userId);
  }
}
```

`setAttributes` is a no-op when no span is active, so it never throws.

### (b) Open a dedicated span from the DTO

Use when the operation deserves its own span. The name comes from
`@TelemetryOperation`:

```ts
async login(userId: string, email: string) {
  const dto = new LoginTelemetryDto();
  dto.userId = userId;
  dto.email = email;

  return this.trace.startActiveSpanWith(dto, () => this.doLogin(userId));
  // span "user.login", attributes pre-set, async handled, span auto-ended
}
```

You can still pass `SpanOptions` (e.g. a `kind`) as the last argument:

```ts
import { SpanKind } from '@opentelemetry/api';

this.trace.startActiveSpanWith(dto, () => this.doLogin(userId), {
  kind: SpanKind.INTERNAL,
});
```

## Raw attribute maps

Both methods also accept a plain map, for one-off attributes that don't warrant
a DTO. `startActiveSpanWith` then requires an explicit name:

```ts
this.trace.setAttributes({ 'app.order.id': orderId, 'app.order.total': total });

this.trace.startActiveSpanWith(
  { 'app.order.id': orderId },
  'order.create',
  () => this.persist(order),
);
```

If both an explicit name and a DTO with `@TelemetryOperation` are given, the DTO
wins.

## When to use which

| Situation                                              | Use                          |
| ------------------------------------------------------ | ---------------------------- |
| Add attributes to an already-open span                 | `setAttributes(dto \| map)`  |
| The operation should be its own span                   | `startActiveSpanWith(dto)`   |
| Just tracing a method, no business attributes          | `@Span` / `@Traceable`       |
| A handful of ad-hoc attributes                         | `setAttributes(map)`         |
| Reusable, named operation with a known attribute shape | a DTO class                  |

## Testing DTO-instrumented code

DTOs are plain objects — assert on `buildSpanMap()` directly, no SDK needed:

```ts
it('maps login attributes', () => {
  const dto = new LoginTelemetryDto();
  dto.userId = 'u-1';
  dto.attempts = 2;
  expect(dto.buildSpanMap()).toEqual({
    operation: 'user.login',
    'app.user.id': 'u-1',
    'app.user.attempts': 2,
  });
});
```

To assert that spans are actually emitted, use an `InMemorySpanExporter` — see
[best-practices.md](./best-practices.md#testing).
