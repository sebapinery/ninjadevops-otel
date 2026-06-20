import type { ModuleMetadata, Type } from '@nestjs/common';

/**
 * Options for {@link OpenTelemetryModule}.
 *
 * This library is tracing-only and does **not** bootstrap the OpenTelemetry
 * SDK. Start the SDK (e.g. `@opentelemetry/sdk-node` or
 * `@opentelemetry/auto-instrumentations-node/register`) before Nest boots so a
 * global `TracerProvider` is registered. These options only control which
 * tracer this module's `TraceService` and decorators obtain from it.
 */
export interface OpenTelemetryModuleOptions {
  /**
   * Name of the tracer obtained from the global `TracerProvider`.
   * Defaults to `ninjadevops-otel`.
   */
  tracerName?: string;

  /**
   * Version reported for the tracer (the instrumentation scope version).
   */
  tracerVersion?: string;
}

/**
 * Implement this to provide {@link OpenTelemetryModuleOptions} asynchronously
 * via `OpenTelemetryModule.forRootAsync({ useClass | useExisting })`.
 */
export interface OpenTelemetryOptionsFactory {
  createOpenTelemetryOptions():
    | Promise<OpenTelemetryModuleOptions>
    | OpenTelemetryModuleOptions;
}

/**
 * Async configuration for {@link OpenTelemetryModule.forRootAsync}.
 */
export interface OpenTelemetryModuleAsyncOptions
  extends Pick<ModuleMetadata, 'imports'> {
  useExisting?: Type<OpenTelemetryOptionsFactory>;
  useClass?: Type<OpenTelemetryOptionsFactory>;
  useFactory?: (
    ...args: any[]
  ) => Promise<OpenTelemetryModuleOptions> | OpenTelemetryModuleOptions;
  inject?: any[];
}
