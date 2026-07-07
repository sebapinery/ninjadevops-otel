import 'reflect-metadata';
import { OTEL_NO_SPAN_METADATA } from '../open-telemetry.constants';

/**
 * Opt a class or method out of automatic span instrumentation
 * (`autoInstrument`).
 *
 * On a **class** it excludes every method of that provider/controller. On a
 * **method** it excludes just that method. It has no effect on an explicit
 * {@link Span}/{@link Traceable} — those always win, since they are applied by
 * hand.
 *
 * ```ts
 * @Injectable()
 * @NoSpan()               // never auto-instrument this service
 * export class HealthService {}
 *
 * @Injectable()
 * export class TokensService {
 *   @NoSpan()             // …or exclude a single hot method
 *   isExpired(token: string) {}
 * }
 * ```
 */
export function NoSpan(): ClassDecorator & MethodDecorator {
  return ((
    target: any,
    _propertyKey?: string | symbol,
    descriptor?: PropertyDescriptor,
  ) => {
    if (descriptor?.value) {
      // Method usage: tag the method implementation.
      Reflect.defineMetadata(OTEL_NO_SPAN_METADATA, true, descriptor.value);
      return descriptor;
    }
    // Class usage: tag the constructor.
    Reflect.defineMetadata(OTEL_NO_SPAN_METADATA, true, target);
    return target;
  }) as ClassDecorator & MethodDecorator;
}

/**
 * Whether a class (constructor) has been marked with a class-level
 * {@link NoSpan}.
 */
export function isClassNoSpan(metatype: unknown): boolean {
  return (
    typeof metatype === 'function' &&
    Reflect.getMetadata(OTEL_NO_SPAN_METADATA, metatype) === true
  );
}

/**
 * Whether a method implementation has been marked with a method-level
 * {@link NoSpan}.
 */
export function isMethodNoSpan(method: unknown): boolean {
  return (
    typeof method === 'function' &&
    Reflect.getMetadata(OTEL_NO_SPAN_METADATA, method) === true
  );
}
