import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import { type Span, trace } from '@opentelemetry/api';

/**
 * Parameter decorator that injects the currently active {@link Span} into a
 * route handler. Resolves to `undefined` when no span is active (e.g. tracing
 * disabled), so always guard with optional chaining.
 *
 * ```ts
 * @Get()
 * find(@CurrentSpan() span?: Span) {
 *   span?.setAttribute('app.handler', 'find');
 * }
 * ```
 */
export const CurrentSpan = createParamDecorator(
  (_data: unknown, _ctx: ExecutionContext): Span | undefined =>
    trace.getActiveSpan(),
);
