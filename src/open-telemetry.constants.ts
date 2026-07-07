/**
 * DI token holding the resolved {@link OpenTelemetryModuleOptions}.
 */
export const OTEL_MODULE_OPTIONS = 'OTEL_MODULE_OPTIONS';

/**
 * Default tracer name used by the {@link Span}/{@link Traceable} decorators and,
 * unless overridden, by {@link TraceService}.
 */
export const OTEL_TRACER_NAME = 'ninjadevops-otel';

/**
 * Marker set on a method already wrapped by {@link Span}. Auto-instrumentation
 * reads it to avoid double-wrapping methods that carry an explicit `@Span`.
 */
export const OTEL_SPAN_METADATA = 'ninjadevops-otel:span';

/**
 * Marker set by {@link NoSpan} on a class or method to opt it out of
 * auto-instrumentation.
 */
export const OTEL_NO_SPAN_METADATA = 'ninjadevops-otel:no-span';
