import { type SpanOptions, trace } from '@opentelemetry/api';
import { isObservable, type Observable, tap } from 'rxjs';
import { OTEL_TRACER_NAME } from '../open-telemetry.constants';
import { recordSpanError } from '../trace/trace.service';
import { copyMethodMetadata } from './metadata.util';

/**
 * Wrap a method in an active OpenTelemetry span.
 *
 * The span is made active for the duration of the call so any nested
 * instrumentation (DB drivers, HTTP clients, child `@Span`s) attaches to it.
 * Synchronous, `Promise`-returning and `Observable`-returning methods are all
 * handled, and the span always ends. On error the span is marked `ERROR` and
 * the exception recorded; on success the status is left `UNSET`, per
 * OpenTelemetry guidance (do not set `OK` speculatively).
 *
 * @param name Span name. Defaults to `ClassName.methodName`.
 * @param options Standard OpenTelemetry {@link SpanOptions} (kind, attributes…).
 */
export function Span(
  name?: string,
  options: SpanOptions = {},
): MethodDecorator {
  return (target, propertyKey, descriptor: PropertyDescriptor) => {
    const original = descriptor.value as (...args: any[]) => any;
    const spanName =
      name ?? `${target.constructor.name}.${String(propertyKey)}`;

    descriptor.value = function wrapped(...args: any[]) {
      const tracer = trace.getTracer(OTEL_TRACER_NAME);

      return tracer.startActiveSpan(spanName, options, (span) => {
        try {
          const result = original.apply(this, args);

          if (result instanceof Promise) {
            return result
              .catch((error) => {
                recordSpanError(span, error);
                throw error;
              })
              .finally(() => span.end());
          }

          if (isObservable(result)) {
            return (result as Observable<unknown>).pipe(
              tap({
                error: (error) => recordSpanError(span, error),
                finalize: () => span.end(),
              }),
            );
          }

          span.end();
          return result;
        } catch (error) {
          recordSpanError(span, error);
          span.end();
          throw error;
        }
      });
    };

    copyMethodMetadata(original, descriptor.value);
    return descriptor;
  };
}
