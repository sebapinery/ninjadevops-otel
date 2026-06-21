import { Inject, Injectable } from '@nestjs/common';
import {
  type Context,
  type Span,
  type SpanOptions,
  SpanStatusCode,
  type Tracer,
  trace,
} from '@opentelemetry/api';
import {
  OTEL_MODULE_OPTIONS,
  OTEL_TRACER_NAME,
} from '../open-telemetry.constants';
import type { OpenTelemetryModuleOptions } from '../open-telemetry.interfaces';
import {
  resolveSpanName,
  type TelemetrySource,
  toTelemetryAttributes,
} from '../telemetry';

/**
 * Thin, injectable wrapper around the OpenTelemetry tracing API.
 *
 * It resolves a {@link Tracer} from the globally-registered `TracerProvider`
 * (which the application is responsible for setting up) and exposes helpers to
 * read the active span and start new ones.
 */
@Injectable()
export class TraceService {
  private readonly tracer: Tracer;

  constructor(
    @Inject(OTEL_MODULE_OPTIONS) options: OpenTelemetryModuleOptions,
  ) {
    this.tracer = trace.getTracer(
      options.tracerName ?? OTEL_TRACER_NAME,
      options.tracerVersion,
    );
  }

  /**
   * The tracer backing this service.
   */
  getTracer(): Tracer {
    return this.tracer;
  }

  /**
   * The currently active span, or `undefined` when no span is in context.
   */
  getSpan(): Span | undefined {
    return trace.getActiveSpan();
  }

  /**
   * Start a span **without** making it active. The caller owns its lifecycle
   * and must call `span.end()`.
   */
  startSpan(name: string, options: SpanOptions = {}, context?: Context): Span {
    return this.tracer.startSpan(name, options, context);
  }

  /**
   * Start a span, make it the active span for the duration of `fn`, and end it
   * automatically. Per OpenTelemetry guidance the span is left `UNSET` on
   * success; on a thrown error it is marked `ERROR` and the exception recorded.
   */
  startActiveSpan<T>(
    name: string,
    fn: (span: Span) => T,
    options: SpanOptions = {},
  ): T {
    return this.tracer.startActiveSpan(name, options, (span) => {
      try {
        const result = fn(span);
        if (result instanceof Promise) {
          return result
            .catch((error) => {
              recordSpanError(span, error);
              throw error;
            })
            .finally(() => span.end()) as unknown as T;
        }
        span.end();
        return result;
      } catch (error) {
        recordSpanError(span, error);
        span.end();
        throw error;
      }
    });
  }

  /**
   * Apply a declarative telemetry DTO (or a raw attribute map) to the **active**
   * span. No-op when no span is in context, so it is always safe to call.
   *
   * ```ts
   * this.trace.setAttributes(new LoginTelemetryDto(userId, email));
   * this.trace.setAttributes({ 'app.order.id': orderId });
   * ```
   */
  setAttributes(source: TelemetrySource): void {
    const span = this.getSpan();
    if (!span) {
      return;
    }
    span.setAttributes(toTelemetryAttributes(source));
  }

  /**
   * Open an active span pre-populated with a telemetry source's attributes, run
   * `fn` inside it, and end it automatically — same async handling and error
   * semantics as {@link startActiveSpan}.
   *
   * The span name comes from the DTO's `@TelemetryOperation` when present;
   * otherwise the explicit `name` is used. Passing neither throws.
   */
  startActiveSpanWith<T>(
    source: TelemetrySource,
    fn: (span: Span) => T,
    options?: SpanOptions,
  ): T;
  startActiveSpanWith<T>(
    source: TelemetrySource,
    name: string,
    fn: (span: Span) => T,
    options?: SpanOptions,
  ): T;
  startActiveSpanWith<T>(
    source: TelemetrySource,
    nameOrFn: string | ((span: Span) => T),
    fnOrOptions?: ((span: Span) => T) | SpanOptions,
    options: SpanOptions = {},
  ): T {
    let name: string | undefined;
    let fn: (span: Span) => T;
    let spanOptions: SpanOptions;

    if (typeof nameOrFn === 'function') {
      name = undefined;
      fn = nameOrFn;
      spanOptions = (fnOrOptions as SpanOptions) ?? {};
    } else {
      name = nameOrFn;
      fn = fnOrOptions as (span: Span) => T;
      spanOptions = options;
    }

    const spanName = resolveSpanName(source) ?? name;
    if (!spanName) {
      throw new Error(
        'startActiveSpanWith requires a span name: pass one explicitly or annotate the DTO with @TelemetryOperation',
      );
    }

    const attributes = {
      ...spanOptions.attributes,
      ...toTelemetryAttributes(source),
    };
    return this.startActiveSpan(spanName, fn, { ...spanOptions, attributes });
  }
}

/**
 * Mark a span as failed and attach the exception, normalising non-Error throws.
 * The status message is kept short (no stack trace) per OpenTelemetry guidance.
 */
export function recordSpanError(span: Span, error: unknown): void {
  const err = error instanceof Error ? error : new Error(String(error));
  span.recordException(err);
  span.setStatus({
    code: SpanStatusCode.ERROR,
    message: `${err.name}: ${err.message}`,
  });
}
